"""CelesTrak TLE/GP data fetching and caching service."""

import logging
import math
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

HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_group(group_name: str, timeout: int = None) -> list[dict]:
    """
    Fetch GP data for a satellite group from CelesTrak JSON API.

    Handles two query types:
      - GROUP=xxx for named groups (stations, visual, etc.)
      - INTDES=xxx for international designator searches (e.g., 1982-092)
    """
    timeout = timeout or Config.CELESTRAK_TIMEOUT

    # Determine query type: if it looks like an INTDES (YYYY-NNN), use INTDES param
    if _is_intdes(group_name):
        url = f"{Config.CELESTRAK_BASE_URL}?INTDES={group_name}&FORMAT=JSON"
    else:
        url = f"{Config.CELESTRAK_BASE_URL}?GROUP={group_name}&FORMAT=JSON"

    logger.info(f"Fetching GP data for '{group_name}' from CelesTrak...")
    logger.info(f"  URL: {url}")

    try:
        response = requests.get(url, headers=HTTP_HEADERS, timeout=timeout)
        response.raise_for_status()

        # CelesTrak returns empty string or error HTML for no results
        text = response.text.strip()
        if not text or text.startswith("<!") or text.startswith("<html"):
            logger.warning(f"  → No data returned for '{group_name}' (empty or HTML response).")
            return []

        data = response.json()

        if isinstance(data, list):
            logger.info(f"  → Received {len(data)} objects for '{group_name}'.")
            return data
        elif isinstance(data, dict):
            # Single result comes as a dict, not a list
            logger.info(f"  → Received 1 object for '{group_name}'.")
            return [data]
        else:
            logger.warning(f"  → Unexpected response format for '{group_name}'.")
            return []

    except requests.exceptions.Timeout:
        logger.error(f"  → Timeout fetching '{group_name}' from CelesTrak.")
        return []
    except requests.exceptions.HTTPError as e:
        logger.error(f"  → HTTP error for '{group_name}': {e}")
        return []
    except requests.exceptions.RequestException as e:
        logger.error(f"  → Request failed for '{group_name}': {e}")
        return []
    except ValueError as e:
        logger.error(f"  → Invalid JSON for '{group_name}': {e}")
        return []


def _is_intdes(name: str) -> bool:
    """Check if a group name looks like an international designator (YYYY-NNN)."""
    parts = name.split("-")
    if len(parts) == 2 and len(parts[0]) == 4 and parts[0].isdigit():
        return True
    return False


def _parse_omm_record(record: dict, group_name: str) -> dict | None:
    """
    Parse a single OMM JSON record into a dict suitable for DB upsert.

    CelesTrak JSON returns OMM parameters (not TLE lines), so we generate
    TLE lines from the OMM fields for use with sgp4.twoline2rv().

    CelesTrak OMM JSON fields:
        OBJECT_NAME, OBJECT_ID, NORAD_CAT_ID, OBJECT_TYPE,
        EPOCH, MEAN_MOTION, ECCENTRICITY, INCLINATION,
        RA_OF_ASC_NODE, ARG_OF_PERICENTER, MEAN_ANOMALY,
        EPHEMERIS_TYPE, CLASSIFICATION_TYPE, ELEMENT_SET_NO,
        REV_AT_EPOCH, BSTAR, MEAN_MOTION_DOT, MEAN_MOTION_DDOT,
        RCS_SIZE
    """
    try:
        norad_id = int(record.get("NORAD_CAT_ID", 0))
        if norad_id == 0:
            return None

        # Generate TLE lines from OMM parameters
        tle_line1, tle_line2 = _omm_to_tle(record)
        if not tle_line1 or not tle_line2:
            return None

        epoch_str = record.get("EPOCH", "")
        epoch = None
        if epoch_str:
            try:
                epoch = datetime.fromisoformat(epoch_str.replace("Z", "+00:00"))
            except ValueError:
                epoch = None

        # Calculate apogee/perigee from mean motion and eccentricity
        mean_motion = record.get("MEAN_MOTION")
        eccentricity = record.get("ECCENTRICITY")
        apogee = None
        perigee = None
        period = None

        if mean_motion and eccentricity:
            try:
                mm = float(mean_motion)
                ecc = float(eccentricity)
                if mm > 0:
                    mu = 398600.4418  # km^3/s^2
                    n = mm * 2.0 * math.pi / 86400.0  # rad/s
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
            "object_type": _infer_object_type(record),
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


def _infer_object_type(record: dict) -> str:
    """Infer object type from CelesTrak GP data, falling back to name heuristics."""
    obj_type = record.get("OBJECT_TYPE", "").strip().upper()
    if obj_type and obj_type != "UNKNOWN":
        if obj_type == "PAY": return "PAYLOAD"
        if obj_type == "DEB": return "DEBRIS"
        if obj_type == "R/B": return "ROCKET BODY"
        return obj_type

    name = record.get("OBJECT_NAME", "").strip().upper()
    if " DEB" in name or " DEBRIS" in name:
        return "DEBRIS"
    if " R/B" in name or " ROCKET" in name or name.endswith(" AKM") or name.endswith(" PKM"):
        return "ROCKET BODY"
    
    return "PAYLOAD"

def _omm_to_tle(record: dict) -> tuple[str, str]:
    """
    Generate TLE two-line element strings from CelesTrak OMM JSON fields.

    Reference: https://celestrak.org/columns/v04n03/
    """
    try:
        norad_id = int(record.get("NORAD_CAT_ID", 0))
        classification = record.get("CLASSIFICATION_TYPE", "U")[0]
        intl_des = record.get("OBJECT_ID", "").strip()
        epoch_str = record.get("EPOCH", "")
        ndot = float(record.get("MEAN_MOTION_DOT", 0))
        nddot = float(record.get("MEAN_MOTION_DDOT", 0))
        bstar = float(record.get("BSTAR", 0))
        ephtype = int(record.get("EPHEMERIS_TYPE", 0))
        elset_no = int(record.get("ELEMENT_SET_NO", 999))
        incl = float(record.get("INCLINATION", 0))
        raan = float(record.get("RA_OF_ASC_NODE", 0))
        ecc = float(record.get("ECCENTRICITY", 0))
        argp = float(record.get("ARG_OF_PERICENTER", 0))
        ma = float(record.get("MEAN_ANOMALY", 0))
        mm = float(record.get("MEAN_MOTION", 0))
        revnum = int(record.get("REV_AT_EPOCH", 0))

        if norad_id == 0 or mm == 0:
            return ("", "")

        # Parse epoch to YY + day-of-year.fraction
        epoch_dt = datetime.fromisoformat(epoch_str.replace("Z", "+00:00"))
        year_short = epoch_dt.year % 100
        day_of_year = epoch_dt.timetuple().tm_yday
        frac_of_day = (
            epoch_dt.hour * 3600
            + epoch_dt.minute * 60
            + epoch_dt.second
            + epoch_dt.microsecond / 1e6
        ) / 86400.0
        epoch_tle = f"{year_short:02d}{day_of_year + frac_of_day:012.8f}"

        # Format international designator for TLE (YY + launch# + piece)
        intl_tle = _format_intl_des(intl_des)

        # Format ndot (first derivative of mean motion / 2)
        ndot_str = _format_decimal(ndot, 10)

        # Format nddot and bstar in exponential TLE notation
        nddot_str = _format_tle_exp(nddot)
        bstar_str = _format_tle_exp(bstar)

        # Build Line 1 (69 chars)
        # 1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N NNNNN
        line1 = f"1 {norad_id:05d}{classification} {intl_tle:<8s} {epoch_tle} {ndot_str} {nddot_str} {bstar_str} {ephtype} {elset_no:4d}"

        # Build Line 2 (69 chars)
        # 2 NNNNN NNN.NNNN NNN.NNNN NNNNNNN NNN.NNNN NNN.NNNN NN.NNNNNNNNNNNNNN
        ecc_str = f"{ecc:.7f}"[2:]  # Remove "0." prefix
        line2 = f"2 {norad_id:05d} {incl:8.4f} {raan:8.4f} {ecc_str} {argp:8.4f} {ma:8.4f} {mm:11.8f}{revnum:5d}"

        # Add checksums
        line1 = line1[:68] + str(_tle_checksum(line1))
        line2 = line2[:68] + str(_tle_checksum(line2))

        return (line1, line2)

    except Exception as e:
        logger.debug(f"  → TLE generation failed for {record.get('NORAD_CAT_ID')}: {e}")
        return ("", "")


def _format_intl_des(intl_des: str) -> str:
    """Format international designator from YYYY-NNNXXX to YYNNNXXX."""
    if not intl_des or "-" not in intl_des:
        return "00000A  "
    parts = intl_des.split("-", 1)
    year_short = parts[0][-2:]  # Last 2 digits of year
    rest = parts[1] if len(parts) > 1 else "000A"
    return f"{year_short}{rest}"


def _format_decimal(value: float, width: int) -> str:
    """Format a decimal value for TLE line 1 (ndot field)."""
    if value == 0:
        return " .00000000"
    sign = " " if value >= 0 else "-"
    s = f"{abs(value):.8f}"
    # Remove leading zero
    if s.startswith("0."):
        s = s[1:]
    return f"{sign}{s}"[:width]


def _format_tle_exp(value: float) -> str:
    """
    Format a value in TLE exponential notation: +NNNNN-N or -NNNNN-N
    Example: 0.00018153585 -> ' 18154-3'
    """
    if value == 0:
        return " 00000-0"

    sign = " " if value >= 0 else "-"
    v = abs(value)

    if v == 0:
        return " 00000-0"

    # Find exponent
    exp = math.floor(math.log10(v)) + 1
    mantissa = v / (10.0 ** (exp - 5))  # Scale to 5 digits
    mantissa_int = int(round(mantissa))

    # Cap mantissa at 5 digits
    if mantissa_int >= 100000:
        mantissa_int = 99999

    exp_sign = "+" if exp >= 0 else "-"
    return f"{sign}{mantissa_int:05d}{exp_sign}{abs(exp)}"


def _tle_checksum(line: str) -> int:
    """Compute TLE line checksum (mod 10 of sum of digits, '-' counts as 1)."""
    s = 0
    for ch in line[:68]:
        if ch.isdigit():
            s += int(ch)
        elif ch == "-":
            s += 1
    return s % 10


def _safe_float(value) -> float | None:
    """Safely convert a value to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def seed_catalog_if_empty() -> int:
    """
    If the database has no satellites, populate it from the bundled seed dataset.
    Ensures zero downtime and complete data availability even when CelesTrak is unreachable.
    """
    if Satellite.query.count() > 0:
        return 0

    logger.info("Catalog is empty. Populating with bundled seed orbital dataset...")
    try:
        from .seed_data import get_seed_satellites
        seeds = get_seed_satellites()
        count = 0
        for data in seeds:
            sat = Satellite(**data)
            db.session.add(sat)
            count += 1
        db.session.commit()
        logger.info(f"Successfully seeded catalog with {count} orbital objects.")
        _last_fetch_time["catalog"] = datetime.now(timezone.utc)
        return count
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to seed catalog: {e}")
        return 0


def sync_catalog(groups: list[str] = None) -> dict:
    """
    Fetch GP data for all configured groups and upsert into the database.

    Returns:
        Summary dict with counts: {group_name: count, ...}
    """
    # Ensure baseline data is present immediately so app never renders empty
    seed_catalog_if_empty()

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
            if count > 0:
                logger.info(f"  → Upserted {count} satellites for group '{group}'.")
        except Exception as e:
            db.session.rollback()
            logger.error(f"  → DB error for group '{group}': {e}")
            count = 0

        summary[group] = count
        total_upserted += count

        # Small delay between group fetches to be polite to CelesTrak
        time.sleep(1)

    if total_upserted > 0:
        _last_fetch_time["catalog"] = datetime.now(timezone.utc)
        logger.info(f"Catalog sync complete. Total: {total_upserted} objects across {len(groups)} groups.")
    else:
        logger.warning("CelesTrak sync yielded 0 live objects. Preserving existing/seed catalog.")
        seed_catalog_if_empty()

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
