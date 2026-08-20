/* ---- TypeScript interfaces matching backend models ---- */

export interface Satellite {
  norad_id: number;
  name: string;
  intl_designator: string | null;
  object_type: string;
  group_name: string | null;
  inclination_deg: number | null;
  eccentricity: number | null;
  period_min: number | null;
  apogee_km: number | null;
  perigee_km: number | null;
  raan_deg: number | null;
  arg_perigee_deg: number | null;
  mean_anomaly_deg: number | null;
  mean_motion: number | null;
  rcs_size: string | null;
  epoch: string | null;
  updated_at: string | null;
}

export interface SatellitePosition {
  norad_id: number;
  name: string;
  object_type: string;
  latitude: number;
  longitude: number;
  altitude_km: number;
  speed_km_s: number;
  position_eci: number[];
  velocity_eci: number[];
}

export interface ConjunctionEvent {
  id: number;
  object1_norad_id: number;
  object1_name: string | null;
  object2_norad_id: number;
  object2_name: string | null;
  tca: string;
  miss_distance_km: number;
  relative_velocity_km_s: number | null;
  approach_angle_deg: number | null;
  obj1_lat: number | null;
  obj1_lon: number | null;
  obj1_alt_km: number | null;
  obj2_lat: number | null;
  obj2_lon: number | null;
  obj2_alt_km: number | null;
  risk_score: number;
  risk_probability: number;
  status: string;
  created_at: string;
}

export interface TimelinePoint {
  time: string;
  max_risk_score: number;
  event_count: number;
}

export interface CatalogStats {
  total: number;
  by_type: Record<string, number>;
  by_group: Record<string, number>;
  last_sync: string | null;
}

export interface ApiResponse<T> {
  count?: number;
  total?: number;
  page?: number;
  pages?: number;
  [key: string]: unknown;
  data?: T;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function getRiskColor(score: number): string {
  const level = getRiskLevel(score);
  switch (level) {
    case 'critical': return '#dc2626';
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#10b981';
  }
}

export function getObjectTypeColor(type: string): string {
  switch (type?.toUpperCase()) {
    case 'PAYLOAD': return '#00d4ff';
    case 'DEBRIS': return '#ef4444';
    case 'ROCKET BODY': return '#f59e0b';
    default: return '#6b7280';
  }
}

export function formatCountdown(tcaStr: string): string {
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
