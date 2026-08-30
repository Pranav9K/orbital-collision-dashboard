"""
Evasive Maneuver Recommendation Service.

Uses real astrodynamics to compute the minimum Delta-V burn required for an active
satellite to avoid a predicted conjunction. Implements a Hohmann-based
position-shift approach -- the standard method used for routine debris avoidance.

Physics:
    For a near-circular orbit, a prograde/retrograde burn dV applied at time
    t_lead before TCA causes a position shift at TCA approximated via
    the Clohessy-Wiltshire (Hill's) equations.

    Fuel mass is estimated via the Tsiolkovsky Rocket Equation:
        m_prop = m_sat * (1 - exp(-dV / (Isp * g0)))
"""

import math
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Physical constants
MU_EARTH = 3.986004418e14   # Earth gravitational parameter (m^3/s^2)
EARTH_RADIUS_M = 6_371_000.0
G0 = 9.80665                # Standard gravity (m/s^2)

# Defaults
DEFAULT_SAT_MASS_KG = 500.0
DEFAULT_ISP_S = 220.0       # Hydrazine monopropellant
MIN_FEASIBLE_DV = 0.01      # m/s
MAX_FEASIBLE_DV = 50.0      # m/s
SAFE_MISS_DISTANCE_KM = 5.0


def recommend_maneuver(event_dict, target_miss_km=SAFE_MISS_DISTANCE_KM, burn_lead_time_min=60.0):
    """
    Compute an evasive maneuver recommendation for a conjunction event.

    Args:
        event_dict: The conjunction event dict (from ConjunctionEvent.to_dict())
        target_miss_km: Desired miss distance after maneuver (km)
        burn_lead_time_min: How many minutes before TCA to fire the thruster

    Returns:
        Dict with all maneuver parameters and feasibility assessment.
    """
    try:
        return _compute_maneuver(event_dict, target_miss_km, burn_lead_time_min)
    except Exception as e:
        logger.error(f"Maneuver computation failed for event {event_dict.get('id')}: {e}")
        return {
            "feasible": False,
            "reason": f"Computation error: {str(e)}",
            "event_id": event_dict.get("id"),
            "delta_v_m_s": None,
        }


def _compute_maneuver(event, target_miss_km, burn_lead_time_min):
    event_id = event.get("id")
    current_miss_km = float(event.get("miss_distance_km") or 0.0)
    rel_vel_km_s = float(event.get("relative_velocity_km_s") or 7.5)
    risk_score = event.get("risk_score", 0)

    # Determine which object is maneuverable (prefer PAYLOAD as Object 1)
    obj1_name = (event.get("object1_name") or "").upper()
    obj2_name = (event.get("object2_name") or "").upper()

    # Infer type from name if not explicitly set
    def is_debris(name):
        return any(k in name for k in ("DEB", "R/B", "ROCKET BODY", "DEBRIS"))

    obj1_is_debris = is_debris(obj1_name)
    obj2_is_debris = is_debris(obj2_name)

    if not obj1_is_debris:
        maneuvering_name = event.get("object1_name", "Object 1")
        maneuvering_norad = event.get("object1_norad_id")
        threat_name = event.get("object2_name", "Object 2")
        maneuvering_alt_km = float(event.get("obj1_alt_km") or 500.0)
    elif not obj2_is_debris:
        maneuvering_name = event.get("object2_name", "Object 2")
        maneuvering_norad = event.get("object2_norad_id")
        threat_name = event.get("object1_name", "Object 1")
        maneuvering_alt_km = float(event.get("obj2_alt_km") or 500.0)
    else:
        return {
            "feasible": False,
            "reason": "Neither object is an active maneuverable payload. No maneuver possible.",
            "event_id": event_id,
            "delta_v_m_s": None,
        }

    # Orbital mechanics
    alt_m = maneuvering_alt_km * 1000.0
    orbit_radius_m = EARTH_RADIUS_M + alt_m

    # Orbital velocity (circular orbit, vis-viva)
    v_orbital_m_s = math.sqrt(MU_EARTH / orbit_radius_m)

    # Mean motion n (rad/s)
    n = math.sqrt(MU_EARTH / orbit_radius_m ** 3)

    # Lead time in seconds
    t_lead_s = burn_lead_time_min * 60.0

    # Required position shift
    delta_r_needed_km = max(0.0, target_miss_km - current_miss_km)
    delta_r_needed_m = delta_r_needed_km * 1000.0

    if delta_r_needed_m <= 0:
        return {
            "feasible": True,
            "reason": "Miss distance already exceeds the safe threshold. No maneuver needed.",
            "event_id": event_id,
            "maneuvering_object": maneuvering_name,
            "maneuvering_norad": maneuvering_norad,
            "threat_object": threat_name,
            "delta_v_m_s": 0.0,
            "burn_direction": "NONE",
            "burn_lead_time_min": 0.0,
            "predicted_miss_km": current_miss_km,
            "current_miss_km": current_miss_km,
            "target_miss_km": target_miss_km,
            "orbital_velocity_km_s": round(v_orbital_m_s / 1000, 3),
            "orbital_altitude_km": maneuvering_alt_km,
            "fuel_mass_kg": 0.0,
            "risk_score": risk_score,
        }

    # Clohessy-Wiltshire position shift per unit dV
    n_t = n * t_lead_s
    pos_shift_per_dv = (2.0 / n) * math.sqrt(
        (1 - math.cos(n_t)) ** 2 + math.sin(n_t) ** 2
    )
    if pos_shift_per_dv < 1e-6:
        pos_shift_per_dv = 2.0 * t_lead_s

    delta_v_m_s = delta_r_needed_m / pos_shift_per_dv

    # Compute individual components for reporting
    radial_shift_m = (2.0 * delta_v_m_s / n) * math.sin(n_t)
    along_shift_m  = (2.0 * delta_v_m_s / n) * (1 - math.cos(n_t))
    total_shift_m  = math.sqrt(radial_shift_m ** 2 + along_shift_m ** 2)

    # Predicted new miss distance
    predicted_miss_m = math.sqrt((current_miss_km * 1000.0) ** 2 + total_shift_m ** 2)
    predicted_miss_km = predicted_miss_m / 1000.0

    # Tsiolkovsky fuel estimate
    isp = DEFAULT_ISP_S
    m_sat = DEFAULT_SAT_MASS_KG
    exhaust_velocity = isp * G0
    fuel_fraction = 1.0 - math.exp(-delta_v_m_s / exhaust_velocity)
    fuel_mass_kg = m_sat * fuel_fraction

    # Feasibility
    if delta_v_m_s < MIN_FEASIBLE_DV:
        feasible = True
        reason = "Burn too small to measure -- the objects will naturally separate safely."
    elif delta_v_m_s > MAX_FEASIBLE_DV:
        feasible = False
        reason = (
            f"Required burn ({delta_v_m_s:.1f} m/s) exceeds practical limits ({MAX_FEASIBLE_DV} m/s). "
            "Try increasing the lead time or reducing the target miss distance."
        )
    else:
        feasible = True
        reason = "Maneuver is feasible with standard hydrazine propulsion."

    # Burn timing UTC
    burn_time_utc = None
    tca_str = event.get("tca")
    if tca_str:
        try:
            tca_dt = datetime.fromisoformat(tca_str.replace("Z", "+00:00"))
            burn_dt = tca_dt - timedelta(minutes=burn_lead_time_min)
            burn_time_utc = burn_dt.isoformat()
        except Exception:
            pass

    return {
        "feasible": feasible,
        "reason": reason,
        "event_id": event_id,

        # Objects
        "maneuvering_object": maneuvering_name,
        "maneuvering_norad": maneuvering_norad,
        "threat_object": threat_name,

        # Burn parameters
        "delta_v_m_s": round(delta_v_m_s, 4),
        "burn_direction": "PROGRADE",
        "burn_lead_time_min": burn_lead_time_min,
        "burn_time_utc": burn_time_utc,

        # Components
        "radial_shift_km": round(radial_shift_m / 1000, 3),
        "along_track_shift_km": round(along_shift_m / 1000, 3),

        # Miss distances
        "current_miss_km": round(current_miss_km, 3),
        "target_miss_km": target_miss_km,
        "predicted_miss_km": round(predicted_miss_km, 3),
        "miss_improvement_km": round(predicted_miss_km - current_miss_km, 3),

        # Orbital context
        "orbital_altitude_km": round(maneuvering_alt_km, 1),
        "orbital_velocity_km_s": round(v_orbital_m_s / 1000.0, 3),
        "relative_velocity_km_s": rel_vel_km_s,
        "mean_motion_rad_s": round(n, 8),

        # Fuel
        "fuel_mass_kg": round(fuel_mass_kg, 4),
        "isp_s": isp,
        "assumed_sat_mass_kg": m_sat,

        "risk_score": risk_score,
    }
