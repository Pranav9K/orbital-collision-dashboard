/**
 * Detail panel for a selected orbital object.
 */
import { X, MapPin, Gauge, Orbit } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor } from '../../types';

export default function ObjectDetail() {
  const selectedSatelliteId = useAppStore((s) => s.selectedSatelliteId);
  const satellites = useAppStore((s) => s.satellites);
  const positions = useAppStore((s) => s.positions);
  const selectSatellite = useAppStore((s) => s.selectSatellite);

  const satellite = useMemo(() => satellites.find((s) => s.norad_id === selectedSatelliteId), [satellites, selectedSatelliteId]);
  const position = useMemo(() => positions.find((p) => p.norad_id === selectedSatelliteId), [positions, selectedSatelliteId]);

  if (!satellite) return null;

  const color = getObjectTypeColor(satellite.object_type);

  return (
    <div className="glass-panel" id="object-detail">
      <div className="section-header">
        <span className="section-header__title" style={{ color }}>{satellite.name}</span>
        <button className="icon-button" onClick={() => selectSatellite(null)} title="Close">
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <div className="detail-row">
          <span className="detail-row__label">NORAD ID</span>
          <span className="detail-row__value mono">{satellite.norad_id}</span>
        </div>
        <div className="detail-row">
          <span className="detail-row__label">Int'l Designator</span>
          <span className="detail-row__value mono">{satellite.intl_designator || '—'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-row__label">Type</span>
          <span className="detail-row__value" style={{ color }}>{satellite.object_type}</span>
        </div>

        {position && (
          <>
            <div className="detail-section" style={{ marginTop: 'var(--space-xs)' }}>
              <div className="detail-section__header"><MapPin size={12} /> Current Position</div>
              <div className="detail-row">
                <span className="detail-row__label">Latitude</span>
                <span className="detail-row__value mono">{position.latitude?.toFixed(4)}°</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">Longitude</span>
                <span className="detail-row__value mono">{position.longitude?.toFixed(4)}°</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">Altitude</span>
                <span className="detail-row__value mono">{position.altitude_km?.toFixed(1)} km</span>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">Speed</span>
                <span className="detail-row__value mono"><Gauge size={10} /> {position.speed_km_s?.toFixed(3)} km/s</span>
              </div>
            </div>
          </>
        )}

        <div className="detail-section" style={{ marginTop: 'var(--space-xs)' }}>
          <div className="detail-section__header"><Orbit size={12} /> Orbital Parameters</div>
          <div className="detail-row">
            <span className="detail-row__label">Inclination</span>
            <span className="detail-row__value mono">{satellite.inclination_deg?.toFixed(4)}°</span>
          </div>
          <div className="detail-row">
            <span className="detail-row__label">Eccentricity</span>
            <span className="detail-row__value mono">{satellite.eccentricity?.toFixed(7)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-row__label">Period</span>
            <span className="detail-row__value mono">{satellite.period_min?.toFixed(2)} min</span>
          </div>
          <div className="detail-row">
            <span className="detail-row__label">Apogee</span>
            <span className="detail-row__value mono">{satellite.apogee_km?.toFixed(1)} km</span>
          </div>
          <div className="detail-row">
            <span className="detail-row__label">Perigee</span>
            <span className="detail-row__value mono">{satellite.perigee_km?.toFixed(1)} km</span>
          </div>
          <div className="detail-row">
            <span className="detail-row__label">RAAN</span>
            <span className="detail-row__value mono">{satellite.raan_deg?.toFixed(4)}°</span>
          </div>
          <div className="detail-row">
            <span className="detail-row__label">Mean Motion</span>
            <span className="detail-row__value mono">{satellite.mean_motion?.toFixed(8)} rev/d</span>
          </div>
        </div>
      </div>
    </div>
  );
}
