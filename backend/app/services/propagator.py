"""SGP4 orbital propagation engine.

Uses the Python sgp4 reference implementation to propagate satellite orbits
from TLE data. Provides both single-satellite and vectorized batch operations.
"""

import logging
import math
from datetime import datetime, timezone

import numpy as np
from sgp4.api import Satrec, jday
from sgp4.api import WGS72

logger = logging.getLogger(__name__)

# Constants
EARTH_RADIUS_KM = 6378.137  # WGS84 equatorial radius
EARTH_FLATTENING = 1.0 / 298.257223563
DEG2RAD = math.pi / 180.0
RAD2DEG = 180.0 / math.pi
TWOPI = 2.0 * math.pi


def tle_to_satrec(tle_line1: str, tle_line2: str) -> Satrec | None:
    """Parse TLE lines into an sgp4 Satrec object."""
    try:
        satellite = Satrec.twoline2rv(tle_line1, tle_line2, WGS72)
        return satellite
    except Exception as e:
        logger.warning(f"Failed to parse TLE: {e}")
        return None


def propagate_single(
    tle_line1: str,
    tle_line2: str,
    dt: datetime,
) -> dict | None:
    """
    Propagate a single satellite to a specific datetime.

    Returns:
        Dict with ECI position/velocity and geodetic coordinates,
        or None if propagation fails.
    """
    satrec = tle_to_satrec(tle_line1, tle_line2)
    if satrec is None:
        return None

    # Convert datetime to Julian date
    jd, fr = _datetime_to_jday(dt)

    # Propagate
    error_code, position_eci, velocity_eci = satrec.sgp4(jd, fr)

    if error_code != 0:
        return None

    # Convert to arrays
    pos = np.array(position_eci)  # km in TEME
    vel = np.array(velocity_eci)  # km/s in TEME

    # TEME → ECEF → Geodetic
    lat, lon, alt = eci_to_geodetic(pos, dt)

    return {
        "position_eci": {"x": pos[0], "y": pos[1], "z": pos[2]},
        "velocity_eci": {"x": vel[0], "y": vel[1], "z": vel[2]},
        "latitude": lat,
        "longitude": lon,
        "altitude_km": alt,
        "speed_km_s": float(np.linalg.norm(vel)),
    }


def propagate_batch(
    satellites: list[dict],
    timestamps: list[datetime],
) -> np.ndarray:
    """
    Propagate multiple satellites across multiple timestamps.

    Args:
        satellites: List of dicts with 'tle_line1' and 'tle_line2' keys
        timestamps: List of datetime objects

    Returns:
        NumPy array of shape (n_sats, n_times, 6) containing [x, y, z, vx, vy, vz]
        in ECI (TEME) frame. NaN for failed propagations.
    """
    n_sats = len(satellites)
    n_times = len(timestamps)

    # Pre-allocate output array
    results = np.full((n_sats, n_times, 6), np.nan, dtype=np.float64)

    # Pre-convert timestamps to Julian dates
    jdays = np.array([_datetime_to_jday(t) for t in timestamps])

    # Parse all satrecs upfront
    satrecs = []
    valid_indices = []
    for i, sat in enumerate(satellites):
        sr = tle_to_satrec(sat["tle_line1"], sat["tle_line2"])
        if sr is not None:
            satrecs.append(sr)
            valid_indices.append(i)

    # Propagate each valid satellite
    for idx, (sat_idx, satrec) in enumerate(zip(valid_indices, satrecs)):
        for t_idx in range(n_times):
            jd, fr = jdays[t_idx]
            error_code, pos, vel = satrec.sgp4(jd, fr)
            if error_code == 0:
                results[sat_idx, t_idx, :3] = pos
                results[sat_idx, t_idx, 3:] = vel

    return results


def get_positions_at_time(
    satellites: list[dict],
    dt: datetime,
) -> list[dict]:
    """
    Get geodetic positions for all satellites at a single time.

    Args:
        satellites: List of dicts with 'norad_id', 'name', 'tle_line1', 'tle_line2', etc.
        dt: Target datetime

    Returns:
        List of position dicts with norad_id, lat, lon, alt, speed
    """
    positions = []

    jd, fr = _datetime_to_jday(dt)

    for sat in satellites:
        satrec = tle_to_satrec(sat["tle_line1"], sat["tle_line2"])
        if satrec is None:
            continue

        error_code, pos_eci, vel_eci = satrec.sgp4(jd, fr)
        if error_code != 0:
            continue

        pos = np.array(pos_eci)
        vel = np.array(vel_eci)

        lat, lon, alt = eci_to_geodetic(pos, dt)

        positions.append({
            "norad_id": sat.get("norad_id"),
            "name": sat.get("name", ""),
            "object_type": sat.get("object_type", "UNKNOWN"),
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "altitude_km": round(alt, 2),
            "speed_km_s": round(float(np.linalg.norm(vel)), 3),
            "position_eci": [round(float(p), 3) for p in pos],
            "velocity_eci": [round(float(v), 6) for v in vel],
        })

    return positions


def eci_to_geodetic(pos_eci: np.ndarray, dt: datetime) -> tuple[float, float, float]:
    """
    Convert ECI (TEME) position to geodetic coordinates (lat, lon, alt).

    Uses GMST for the TEME→ECEF rotation and iterative geodetic conversion.

    Args:
        pos_eci: [x, y, z] in km (TEME frame)
        dt: UTC datetime for GMST calculation

    Returns:
        (latitude_deg, longitude_deg, altitude_km)
    """
    # Calculate GMST (Greenwich Mean Sidereal Time)
    gmst = _gmst(dt)

    # Rotate TEME → ECEF
    cos_g = math.cos(gmst)
    sin_g = math.sin(gmst)
    x_ecef = pos_eci[0] * cos_g + pos_eci[1] * sin_g
    y_ecef = -pos_eci[0] * sin_g + pos_eci[1] * cos_g
    z_ecef = pos_eci[2]

    # ECEF → Geodetic (iterative)
    lon = math.atan2(y_ecef, x_ecef) * RAD2DEG
    r_xy = math.sqrt(x_ecef**2 + y_ecef**2)

    # Initial geodetic latitude estimate
    lat = math.atan2(z_ecef, r_xy)

    # Iterate to refine (Bowring's method, typically converges in 2-3 iterations)
    a = EARTH_RADIUS_KM
    e2 = 2.0 * EARTH_FLATTENING - EARTH_FLATTENING**2

    for _ in range(5):
        sin_lat = math.sin(lat)
        N = a / math.sqrt(1.0 - e2 * sin_lat**2)
        lat = math.atan2(z_ecef + e2 * N * sin_lat, r_xy)

    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    N = a / math.sqrt(1.0 - e2 * sin_lat**2)

    if abs(cos_lat) > 1e-10:
        alt = r_xy / cos_lat - N
    else:
        alt = abs(z_ecef) - N * (1.0 - e2)

    return (lat * RAD2DEG, lon, alt)


def _datetime_to_jday(dt: datetime) -> tuple[float, float]:
    """Convert a datetime to Julian date components (jd, fr)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    jd, fr = jday(
        dt.year, dt.month, dt.day,
        dt.hour, dt.minute,
        dt.second + dt.microsecond / 1e6,
    )
    return (jd, fr)


def _gmst(dt: datetime) -> float:
    """
    Calculate Greenwich Mean Sidereal Time in radians.

    Uses the IAU 1982 formula.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    # Julian date
    jd, fr = _datetime_to_jday(dt)
    j = jd + fr

    # Julian centuries from J2000.0
    t_ut1 = (j - 2451545.0) / 36525.0

    # GMST in seconds of time
    gmst_sec = (
        67310.54841
        + (876600.0 * 3600.0 + 8640184.812866) * t_ut1
        + 0.093104 * t_ut1**2
        - 6.2e-6 * t_ut1**3
    )

    # Convert to radians, normalize to [0, 2π]
    gmst_rad = (gmst_sec % 86400.0) / 86400.0 * TWOPI
    if gmst_rad < 0:
        gmst_rad += TWOPI

    return gmst_rad
