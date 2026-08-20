"""Conjunction (close-approach) screening engine.

Detects pairs of orbital objects whose predicted separation drops below
a configurable threshold within a forward propagation window.

Algorithm:
  1. Apogee-perigee pre-filter (eliminates >90% of impossible pairs)
  2. Coarse screening at N-second steps using NumPy vectorized distances
  3. Fine screening at finer steps around coarse minimums
  4. Event generation with TCA, miss distance, and relative velocity
"""

import logging
from datetime import datetime, timedelta, timezone
from itertools import combinations

import numpy as np

from ..models import db, Satellite, ConjunctionEvent
from ..config import Config
from .propagator import propagate_batch, eci_to_geodetic
from .risk_scorer import compute_risk_score

logger = logging.getLogger(__name__)

# Earth radius for apogee/perigee pre-filter
EARTH_RADIUS_KM = 6378.137


def screen_conjunctions(
    horizon_hours: float = None,
    threshold_km: float = None,
    step_seconds: float = None,
) -> list[dict]:
    """
    Run full conjunction screening for all satellites in the database.

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

    # Load all satellites from DB
    satellites = Satellite.query.all()
    if len(satellites) < 2:
        logger.info("Not enough satellites for conjunction screening.")
        return []

    sat_dicts = [
        {
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
        for s in satellites
    ]

    # Step 1: Apogee-perigee pre-filter
    candidate_pairs = _apogee_perigee_filter(sat_dicts, threshold_km)
    logger.info(
        f"  Apogee-perigee filter: {len(sat_dicts)} objects → "
        f"{len(candidate_pairs)} candidate pairs (from {len(sat_dicts) * (len(sat_dicts)-1) // 2} total)"
    )

    if not candidate_pairs:
        logger.info("  No candidate pairs after pre-filtering.")
        return []

    # Step 2: Build time grid
    now = datetime.now(timezone.utc)
    n_steps = int(horizon_hours * 3600 / step_seconds)
    timestamps = [now + timedelta(seconds=i * step_seconds) for i in range(n_steps)]

    # Step 3: Batch propagation
    logger.info(f"  Propagating {len(sat_dicts)} objects over {n_steps} time steps...")
    positions = propagate_batch(sat_dicts, timestamps)
    # positions shape: (n_sats, n_times, 6) — [x, y, z, vx, vy, vz]

    # Build index map: norad_id → array index
    id_to_idx = {s["norad_id"]: i for i, s in enumerate(sat_dicts)}

    # Step 4: Coarse screening
    coarse_threshold = threshold_km * Config.CONJUNCTION_COARSE_FACTOR
    coarse_events = []

    for norad_a, norad_b in candidate_pairs:
        idx_a = id_to_idx.get(norad_a)
        idx_b = id_to_idx.get(norad_b)
        if idx_a is None or idx_b is None:
            continue

        pos_a = positions[idx_a, :, :3]  # (n_times, 3)
        pos_b = positions[idx_b, :, :3]

        # Skip if either has NaN (propagation failed)
        if np.any(np.isnan(pos_a)) or np.any(np.isnan(pos_b)):
            continue

        # Vectorized distance computation
        diffs = pos_a - pos_b
        distances = np.linalg.norm(diffs, axis=1)

        # Find minimum
        min_idx = np.argmin(distances)
        min_dist = distances[min_idx]

        if min_dist < coarse_threshold:
            coarse_events.append({
                "norad_a": norad_a,
                "norad_b": norad_b,
                "min_step_idx": int(min_idx),
                "coarse_min_dist": float(min_dist),
            })

    logger.info(f"  Coarse screening found {len(coarse_events)} potential events.")

    # Step 5: Fine screening around coarse minimums
    fine_step = Config.PROPAGATION_FINE_STEP_SECONDS
    events = []

    for ce in coarse_events:
        # Fine time window: ±2 coarse steps around the minimum
        center_time = timestamps[ce["min_step_idx"]]
        window_start = center_time - timedelta(seconds=2 * step_seconds)
        window_end = center_time + timedelta(seconds=2 * step_seconds)
        n_fine = int((window_end - window_start).total_seconds() / fine_step)
        fine_times = [window_start + timedelta(seconds=i * fine_step) for i in range(n_fine)]

        # Propagate just this pair at fine resolution
        pair_sats = [
            sat_dicts[id_to_idx[ce["norad_a"]]],
            sat_dicts[id_to_idx[ce["norad_b"]]],
        ]
        fine_positions = propagate_batch(pair_sats, fine_times)

        pos_a = fine_positions[0, :, :3]
        pos_b = fine_positions[1, :, :3]

        if np.any(np.isnan(pos_a)) or np.any(np.isnan(pos_b)):
            continue

        diffs = pos_a - pos_b
        distances = np.linalg.norm(diffs, axis=1)
        min_idx = np.argmin(distances)
        min_dist = float(distances[min_idx])

        if min_dist < threshold_km:
            tca = fine_times[min_idx]

            # Relative velocity at TCA
            vel_a = fine_positions[0, min_idx, 3:]
            vel_b = fine_positions[1, min_idx, 3:]
            rel_vel = float(np.linalg.norm(vel_a - vel_b))

            # Approach angle (angle between velocity vectors)
            approach_angle = _angle_between(vel_a, vel_b)

            # Geodetic positions at TCA
            lat_a, lon_a, alt_a = eci_to_geodetic(pos_a[min_idx], tca)
            lat_b, lon_b, alt_b = eci_to_geodetic(pos_b[min_idx], tca)

            # Get satellite metadata
            sat_a = sat_dicts[id_to_idx[ce["norad_a"]]]
            sat_b = sat_dicts[id_to_idx[ce["norad_b"]]]

            # Compute risk score
            risk_result = compute_risk_score(
                miss_distance_km=min_dist,
                relative_velocity_km_s=rel_vel,
                time_to_tca_hours=max(0, (tca - now).total_seconds() / 3600),
                obj1_type=sat_a.get("object_type", "UNKNOWN"),
                obj2_type=sat_b.get("object_type", "UNKNOWN"),
                obj1_rcs=sat_a.get("rcs_size"),
                obj2_rcs=sat_b.get("rcs_size"),
                approach_angle_deg=approach_angle,
                obj1_period=sat_a.get("period_min"),
                obj2_period=sat_b.get("period_min"),
            )

            event = {
                "object1_norad_id": ce["norad_a"],
                "object2_norad_id": ce["norad_b"],
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
            events.append(event)

    logger.info(f"  Fine screening confirmed {len(events)} conjunction events.")

    # Step 6: Store events in database
    _store_events(events)

    return events


def _apogee_perigee_filter(
    satellites: list[dict],
    threshold_km: float,
) -> list[tuple[int, int]]:
    """
    Pre-filter satellite pairs using apogee-perigee altitude test.

    Two objects can only have a conjunction if their orbital shells overlap:
        apogee_A + threshold >= perigee_B  AND  apogee_B + threshold >= perigee_A
    """
    candidate_pairs = []

    # Build arrays for vectorized comparison
    n = len(satellites)
    apogees = np.array([s.get("apogee_km") or 2000.0 for s in satellites])
    perigees = np.array([s.get("perigee_km") or 150.0 for s in satellites])
    norad_ids = [s["norad_id"] for s in satellites]

    for i in range(n):
        for j in range(i + 1, n):
            if (
                apogees[i] + threshold_km >= perigees[j]
                and apogees[j] + threshold_km >= perigees[i]
            ):
                candidate_pairs.append((norad_ids[i], norad_ids[j]))

    return candidate_pairs


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
