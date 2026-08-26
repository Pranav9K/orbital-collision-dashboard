/**
 * @typedef {Object} Satellite
 * @property {number} norad_id
 * @property {string} name
 * @property {string|null} intl_designator
 * @property {string} object_type
 * @property {string|null} group_name
 * @property {number|null} inclination_deg
 * @property {number|null} eccentricity
 * @property {number|null} period_min
 * @property {number|null} apogee_km
 * @property {number|null} perigee_km
 * @property {number|null} raan_deg
 * @property {number|null} arg_perigee_deg
 * @property {number|null} mean_anomaly_deg
 * @property {number|null} mean_motion
 * @property {string|null} rcs_size
 * @property {string|null} epoch
 * @property {string|null} updated_at
 */

/**
 * @typedef {Object} SatellitePosition
 * @property {number} norad_id
 * @property {string} name
 * @property {string} object_type
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} altitude_km
 * @property {number} speed_km_s
 * @property {number[]} position_eci
 * @property {number[]} velocity_eci
 */

/**
 * @typedef {Object} ConjunctionEvent
 * @property {number} id
 * @property {number} object1_norad_id
 * @property {string|null} object1_name
 * @property {number} object2_norad_id
 * @property {string|null} object2_name
 * @property {string} tca
 * @property {number} miss_distance_km
 * @property {number|null} relative_velocity_km_s
 * @property {number|null} approach_angle_deg
 * @property {number|null} obj1_lat
 * @property {number|null} obj1_lon
 * @property {number|null} obj1_alt_km
 * @property {number|null} obj2_lat
 * @property {number|null} obj2_lon
 * @property {number|null} obj2_alt_km
 * @property {number} risk_score
 * @property {number} risk_probability
 * @property {string} status
 * @property {string} created_at
 */

export function getRiskLevel(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function getRiskColor(score) {
  const level = getRiskLevel(score);
  switch (level) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#fbbf24';
    case 'low': return '#fcd34d';
  }
}

export function getObjectTypeColor(type) {
  switch (type?.toUpperCase()) {
    case 'PAYLOAD': return '#fbbf24';
    case 'DEBRIS': return '#ea580c';
    case 'ROCKET BODY': return '#dc2626';
    case 'STATION': return '#fcd34d';
    default: return '#737373';
  }
}

export function formatCountdown(tcaStr) {
  const tca = new Date(tcaStr);
  const now = new Date();
  const diffMs = tca.getTime() - now.getTime();

  if (diffMs <= 0) return 'PASSED';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
