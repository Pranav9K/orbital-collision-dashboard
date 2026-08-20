"""CelesTrak TLE/GP data fetching and caching service."""

import logging
import time
from datetime import datetime, timezone

import requests

from ..models import db, Satellite
from ..config import Config

logger = logging.getLogger(__name__)

# In-memory rate-limit tracker
_last_fetch_time = {}

# Earth radius for apogee/perigee calculation
EARTH_RADIUS_KM = 6371.0


def fetch_group(group_name: str, timeout: int = None) -> list[dict]:
    """
    Fetch GP data for a satellite group from CelesTrak JSON API.

    Args:
        group_name: CelesTrak group identifier (e.g., 'stations', 'active', '1982-092')
        timeout: Request timeout in seconds

    Returns:
        List of OMM records as dicts
    """
    timeout = timeout or Config.CELESTRAK_TIMEOUT
    url = f"{Config.CELESTRAK_BASE_URL}?GROUP={group_name}&FORMAT=JSON"

    logger.info(f"Fetching TLE data for group '{group_name}' from CelesTrak...")

    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            logger.info(f"  → Received {len(data)} objects for group '{group_name}'.")
            return data
        else:
            logger.warning(f"  → Unexpected response format for group '{group_name}'.")
            return []

    except requests.exceptions.Timeout:
        logger.error(f"  → Timeout fetching group '{group_name}'.")
        return []
    except requests.exceptions.HTTPError as e:
        logger.error(f"  → HTTP error for group '{group_name}': {e}")
        return []
    except requests.exceptions.RequestException as e:
        logger.error(f"  → Request failed for group '{group_name}': {e}")
        return []
    except ValueError:
        logger.error(f"  → Invalid JSON response for group '{group_name}'.")
        return []


def _parse_omm_record(record: dict, group_name: str) -> dict | None:
    """
    Parse a single OMM JSON record into a dict suitable for DB upsert.

    CelesTrak JSON fields:
        OBJECT_NAME, OBJECT_ID, NORAD_CAT_ID, OBJECT_TYPE,
        TLE_LINE1, TLE_LINE2, EPOCH, INCLINATION, ECCENTRICITY,
        PERIOD, APOAPSIS, PERIAPSIS, RA_OF_ASC_NODE, ARG_OF_PERICENTER,
        MEAN_ANOMALY, MEAN_MOTION, RCS_SIZE, etc.
    """
    try:
        norad_id = int(record.get("NORAD_CAT_ID", 0))
        if norad_id == 0:
            return None

        tle_line1 = record.get("TLE_LINE1", "").strip()
        tle_line2 = record.get("TLE_LINE2", "").strip()
        if not tle_line1 or not tle_line2:
            return None

        epoch_str = record.get("EPOCH", "")
        epoch = None
        if epoch_str:
            try:
                epoch = datetime.fromisoformat(epoch_str.replace("Z", "+00:00"))
            except ValueError:
                epoch = None

        # Calculate apogee/perigee from mean motion if not provided directly
        mean_motion = record.get("MEAN_MOTION")
        eccentricity = record.get("ECCENTRICITY")
        apogee = record.get("APOAPSIS")
        perigee = record.get("PERIAPSIS")
        period = record.get("PERIOD")

        if mean_motion and eccentricity and (apogee is None or perigee is None):
            try:
                mm = float(mean_motion)
                ecc = float(eccentricity)
                if mm > 0:
                    # Semi-major axis from mean motion (rev/day)
                    mu = 398600.4418  # km^3/s^2
                    n = mm * 2.0 * 3.14159265358979 / 86400.0  # rad/s
                    a = (mu / (n * n)) ** (1.0 / 3.0)  # km
                    apogee = a * (1 + ecc) - EARTH_RADIUS_KM
                    perigee = a * (1 - ecc) - EARTH_RADIUS_KM
                    period = 1440.0 / mm  # minutes
            except (ValueError, ZeroDivisionError):
                pass

        return {
            "norad_id": norad_id,
            "name": record.get("OBJECT_NAME", f"UNKNOWN-{norad_id}").strip(),
            "intl_designator": record.get("OBJECT_ID", "").strip() or None,
            "object_type": record.get("OBJECT_TYPE", "UNKNOWN").strip(),
            "group_name": group_name,
            "tle_line1": tle_line1,
            "tle_line2": tle_line2,
            "epoch": epoch,
            "inclination_deg": _safe_float(record.get("INCLINATION")),
            "eccentricity": _safe_float(record.get("ECCENTRICITY")),
            "period_min": _safe_float(period),
            "apogee_km": _safe_float(apogee),
            "perigee_km": _safe_float(perigee),
            "raan_deg": _safe_float(record.get("RA_OF_ASC_NODE")),
            "arg_perigee_deg": _safe_float(record.get("ARG_OF_PERICENTER")),
            "mean_anomaly_deg": _safe_float(record.get("MEAN_ANOMALY")),
            "mean_motion": _safe_float(record.get("MEAN_MOTION")),
            "rcs_size": record.get("RCS_SIZE", "").strip() or None,
        }
    except Exception as e:
        logger.warning(f"  → Failed to parse OMM record: {e}")
        return None


def _safe_float(value) -> float | None:
    """Safely convert a value to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def sync_catalog(groups: list[str] = None) -> dict:
    """
    Fetch TLE data for all configured groups and upsert into the database.

    Returns:
        Summary dict with counts: {group_name: count, ...}
    """
    groups = groups or Config.CELESTRAK_GROUPS
    summary = {}
    total_upserted = 0

    for group in groups:
        records = fetch_group(group)
        count = 0

        for record in records:
            parsed = _parse_omm_record(record, group)
            if parsed is None:
                continue

            # Upsert: update if exists, insert if not
            existing = Satellite.query.filter_by(norad_id=parsed["norad_id"]).first()

            if existing:
                for key, value in parsed.items():
                    setattr(existing, key, value)
                existing.updated_at = datetime.now(timezone.utc)
            else:
                sat = Satellite(**parsed)
                db.session.add(sat)

            count += 1

        try:
            db.session.commit()
            logger.info(f"  → Upserted {count} satellites for group '{group}'.")
        except Exception as e:
            db.session.rollback()
            logger.error(f"  → DB error for group '{group}': {e}")
            count = 0

        summary[group] = count
        total_upserted += count

        # Small delay between group fetches to be polite to CelesTrak
        time.sleep(1)

    _last_fetch_time["catalog"] = datetime.now(timezone.utc)
    logger.info(f"Catalog sync complete. Total: {total_upserted} objects across {len(groups)} groups.")
    return summary


def get_catalog_stats() -> dict:
    """Get summary statistics about the satellite catalog."""
    total = Satellite.query.count()
    by_type = (
        db.session.query(Satellite.object_type, db.func.count(Satellite.id))
        .group_by(Satellite.object_type)
        .all()
    )
    by_group = (
        db.session.query(Satellite.group_name, db.func.count(Satellite.id))
        .group_by(Satellite.group_name)
        .all()
    )

    return {
        "total": total,
        "by_type": {t: c for t, c in by_type},
        "by_group": {g: c for g, c in by_group},
        "last_sync": (
            _last_fetch_time.get("catalog", "").isoformat()
            if isinstance(_last_fetch_time.get("catalog"), datetime)
            else None
        ),
    }
