"""Conjunction (close-approach) screening engine.

Detects pairs of orbital objects whose predicted separation drops below
a configurable threshold within a forward propagation window.

Strategy for large catalogs (10K+ objects):
  - Screen a small set of "protected" objects (stations, high-value sats)
    against the full catalog — NOT all-vs-all.
  - Use apogee-perigee pre-filter to skip impossible pairs.
  - Coarse screening at N-second steps, fine screening around minimums.

Algorithm:
  1. Select protected objects (stations + random sample of active sats)
  2. Apogee-perigee pre-filter for each protected object vs catalog
  3. Batch propagation of all relevant objects
  4. Coarse distance screening with NumPy vectorization
  5. Fine screening at finer steps around coarse minimums
  6. Risk scoring and event storage
"""

import logging
import random
from datetime import datetime, timedelta, timezone

import numpy as np

from ..models import db, Satellite, ConjunctionEvent
from ..config import Config
from .propagator import propagate_batch, eci_to_geodetic
from .risk_scorer import compute_risk_score

logger = logging.getLogger(__name__)

# Maximum objects to include in screening for performance
MAX_CATALOG_SIZE = 2000
# Number of "protected" objects to screen against the catalog
MAX_PROTECTED = 50


def screen_conjunctions(
    horizon_hours: float = None,
    threshold_km: float = None,
    step_seconds: float = None,
) -> list[dict]:
    """
    Run conjunction screening: protected objects vs catalog.

    Args:
        horizon_hours: Forward propagation window (hours)
        threshold_km: Close-approach threshold (km)
        step_seconds: Time step for coarse screening (seconds)

    Returns:
        List of conjunction event dicts
    """
    horizon_hours = horizon_hours or Config.PROPAGATION_HORIZON_HOURS
    threshold_km = threshold_km or Config.CONJUNCTION_THRESHOLD_KM
    step_seconds = step_seconds or Config.PROPAGATION_STEP_SECONDS

    logger.info(
        f"Starting conjunction screening: horizon={horizon_hours}h, "
        f"threshold={threshold_km}km, step={step_seconds}s"
    )

    # Load satellites: prioritize stations and debris, sample from active
    protected_sats = _get_protected_objects()
    catalog_sats = _get_screening_catalog()

    if len(protected_sats) == 0 or len(catalog_sats) < 2:
        logger.info("Not enough satellites for conjunction screening.")
        return []

    logger.info(
        f"  Screening {len(protected_sats)} protected objects against "
        f"{len(catalog_sats)} catalog objects"
    )

    # Merge into a single list for batch propagation (dedup by norad_id)
    all_norad_ids = set()
    all_sats = []
    for s in protected_sats + catalog_sats:
        if s["norad_id"] not in all_norad_ids:
            all_norad_ids.add(s["norad_id"])
            all_sats.append(s)

    # Build index map
    id_to_idx = {s["norad_id"]: i for i, s in enumerate(all_sats)}

    # Build time grid
    now = datetime.now(timezone.utc)
    n_steps = int(horizon_hours * 3600 / step_seconds)
    # Cap at 1440 steps (24h at 60s)
    n_steps = min(n_steps, 1440)
    timestamps = [now + timedelta(seconds=i * step_seconds) for i in range(n_steps)]

    # Batch propagation
    logger.info(f"  Propagating {len(all_sats)} objects over {n_steps} time steps...")
    positions = propagate_batch(all_sats, timestamps)
    # positions shape: (n_sats, n_times, 6) — [x, y, z, vx, vy, vz]
    logger.info("  Propagation complete.")

    # Screen each protected object against catalog
    coarse_threshold = threshold_km * Config.CONJUNCTION_COARSE_FACTOR
    events = []
    protected_ids = {s["norad_id"] for s in protected_sats}

    for p_sat in protected_sats:
        p_idx = id_to_idx.get(p_sat["norad_id"])
        if p_idx is None:
            continue

        p_pos = positions[p_idx, :, :3]  # (n_times, 3)
        if np.any(np.isnan(p_pos)):
            continue

        # Check apogee-perigee overlap for this protected object vs catalog
        p_apogee = p_sat.get("apogee_km") or 2000.0
        p_perigee = p_sat.get("perigee_km") or 150.0

        for c_sat in all_sats:
            c_norad = c_sat["norad_id"]
            if c_norad == p_sat["norad_id"]:
                continue

            # Apogee-perigee pre-filter
            c_apogee = c_sat.get("apogee_km") or 2000.0
            c_perigee = c_sat.get("perigee_km") or 150.0
            if p_apogee + threshold_km < c_perigee or c_apogee + threshold_km < p_perigee:
                continue

            c_idx = id_to_idx.get(c_norad)
            if c_idx is None:
                continue

            c_pos = positions[c_idx, :, :3]
            if np.any(np.isnan(c_pos)):
                continue

            # Vectorized distance computation
            diffs = p_pos - c_pos
            distances = np.linalg.norm(diffs, axis=1)
            min_idx = np.argmin(distances)
            min_dist = float(distances[min_idx])

            if min_dist < coarse_threshold:
                # Fine screening
                event = _fine_screen(
                    p_sat, c_sat, all_sats, id_to_idx,
                    timestamps, min_idx, step_seconds,
                    threshold_km, now
                )
                if event is not None:
                    events.append(event)

    logger.info(f"  Screening found {len(events)} conjunction events.")

    # Sort by risk score descending
    events.sort(key=lambda e: e["risk_score"], reverse=True)

    # Store events in database
    _store_events(events)

    return events


def _get_protected_objects() -> list[dict]:
    """Get the set of 'protected' objects to screen (stations + key sats)."""
    protected = []

    # All stations
    stations = Satellite.query.filter(Satellite.group_name == "stations").all()
    for s in stations:
        protected.append(_sat_to_dict(s))

    # All debris objects
    debris = Satellite.query.filter(Satellite.group_name == "1982-092").all()
    for s in debris:
        protected.append(_sat_to_dict(s))

    # If we still have room, add some active satellites
    remaining = MAX_PROTECTED - len(protected)
    if remaining > 0:
        active = (
            Satellite.query
            .filter(Satellite.group_name == "active")
            .order_by(Satellite.norad_id)
            .limit(remaining)
            .all()
        )
        for s in active:
            protected.append(_sat_to_dict(s))

    logger.info(f"  Protected objects: {len(protected)}")
    return protected


def _get_screening_catalog() -> list[dict]:
    """Get the catalog of objects to screen against (capped for performance)."""
    total = Satellite.query.count()

    if total <= MAX_CATALOG_SIZE:
        sats = Satellite.query.all()
    else:
        # Prioritize: all stations + all debris + random sample of active
        sats = []
        stations = Satellite.query.filter(Satellite.group_name == "stations").all()
        debris = Satellite.query.filter(Satellite.group_name == "1982-092").all()
        sats.extend(stations)
        sats.extend(debris)

        remaining = MAX_CATALOG_SIZE - len(sats)
        if remaining > 0:
            # Get evenly-spaced sample from active satellites
            active_count = Satellite.query.filter(Satellite.group_name == "active").count()
            if active_count <= remaining:
                active = Satellite.query.filter(Satellite.group_name == "active").all()
            else:
                # Sample evenly by taking every Nth object
                step_size = max(1, active_count // remaining)
                active = (
                    Satellite.query
                    .filter(Satellite.group_name == "active")
                    .all()
                )[::step_size][:remaining]
            sats.extend(active)

    logger.info(f"  Catalog objects: {len(sats)} (from {total} total)")
    return [_sat_to_dict(s) for s in sats]


def _sat_to_dict(s: Satellite) -> dict:
    """Convert a Satellite model to a dict for propagation."""
    return {
        "norad_id": s.norad_id,
        "name": s.name,
        "object_type": s.object_type,
        "tle_line1": s.tle_line1,
        "tle_line2": s.tle_line2,
        "apogee_km": s.apogee_km,
        "perigee_km": s.perigee_km,
        "rcs_size": s.rcs_size,
        "period_min": s.period_min,
    }


def _fine_screen(
    p_sat: dict,
    c_sat: dict,
    all_sats: list[dict],
    id_to_idx: dict,
    timestamps: list[datetime],
    coarse_min_idx: int,
    step_seconds: float,
    threshold_km: float,
    now: datetime,
) -> dict | None:
    """Fine-screen a candidate pair around the coarse minimum."""
    fine_step = Config.PROPAGATION_FINE_STEP_SECONDS
    center_time = timestamps[coarse_min_idx]

    # Fine window: ±2 coarse steps
    window_start = center_time - timedelta(seconds=2 * step_seconds)
    window_end = center_time + timedelta(seconds=2 * step_seconds)
    n_fine = int((window_end - window_start).total_seconds() / fine_step)
    n_fine = min(n_fine, 100)  # Cap for performance
    fine_times = [window_start + timedelta(seconds=i * fine_step) for i in range(n_fine)]

    # Propagate just this pair at fine resolution
    pair_sats = [p_sat, c_sat]
    fine_positions = propagate_batch(pair_sats, fine_times)

    pos_a = fine_positions[0, :, :3]
    pos_b = fine_positions[1, :, :3]

    if np.any(np.isnan(pos_a)) or np.any(np.isnan(pos_b)):
        return None

    diffs = pos_a - pos_b
    distances = np.linalg.norm(diffs, axis=1)
    min_idx = np.argmin(distances)
    min_dist = float(distances[min_idx])

    if min_dist >= threshold_km:
        return None

    tca = fine_times[min_idx]

    # Relative velocity at TCA
    vel_a = fine_positions[0, min_idx, 3:]
    vel_b = fine_positions[1, min_idx, 3:]
    rel_vel = float(np.linalg.norm(vel_a - vel_b))

    # Approach angle
    approach_angle = _angle_between(vel_a, vel_b)

    # Geodetic positions at TCA
    lat_a, lon_a, alt_a = eci_to_geodetic(pos_a[min_idx], tca)
    lat_b, lon_b, alt_b = eci_to_geodetic(pos_b[min_idx], tca)

    # Risk score
    risk_result = compute_risk_score(
        miss_distance_km=min_dist,
        relative_velocity_km_s=rel_vel,
        time_to_tca_hours=max(0, (tca - now).total_seconds() / 3600),
        obj1_type=p_sat.get("object_type", "UNKNOWN"),
        obj2_type=c_sat.get("object_type", "UNKNOWN"),
        obj1_rcs=p_sat.get("rcs_size"),
        obj2_rcs=c_sat.get("rcs_size"),
        approach_angle_deg=approach_angle,
        obj1_period=p_sat.get("period_min"),
        obj2_period=c_sat.get("period_min"),
    )

    return {
        "object1_norad_id": p_sat["norad_id"],
        "object2_norad_id": c_sat["norad_id"],
        "tca": tca,
        "miss_distance_km": min_dist,
        "relative_velocity_km_s": rel_vel,
        "approach_angle_deg": approach_angle,
        "obj1_lat": lat_a,
        "obj1_lon": lon_a,
        "obj1_alt_km": alt_a,
        "obj2_lat": lat_b,
        "obj2_lon": lon_b,
        "obj2_alt_km": alt_b,
        "risk_score": risk_result["risk_score"],
        "risk_probability": risk_result["risk_probability"],
        "status": "active",
    }


def _angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
    """Compute angle between two vectors in degrees."""
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-10 or n2 < 1e-10:
        return 0.0
    cos_angle = np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def _store_events(events: list[dict]) -> None:
    """Store conjunction events in the database, replacing old active events."""
    try:
        # Expire old active events
        ConjunctionEvent.query.filter_by(status="active").update({"status": "expired"})

        # Insert new events (capped)
        for event_data in events[: Config.CONJUNCTION_MAX_EVENTS]:
            event = ConjunctionEvent(**event_data)
            db.session.add(event)

        db.session.commit()
        logger.info(f"  Stored {min(len(events), Config.CONJUNCTION_MAX_EVENTS)} events in DB.")
    except Exception as e:
        db.session.rollback()
        logger.error(f"  Failed to store conjunction events: {e}")
