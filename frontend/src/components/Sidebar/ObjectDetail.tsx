/**
 * Detail panel for a selected orbital object.
 */

import { X, MapPin, Gauge, Orbit } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor } from '../../types';

export default function ObjectDetail() {
  const satellites = useAppStore((s) => s.satellites);
  const positions = useAppStore((s) => s.positions);
  const selectedSatelliteId = useAppStore((s) => s.selectedSatelliteId);
  const selectSatellite = useAppStore((s) => s.selectSatellite);

  const satellite = useMemo(
    () => satellites.find((s) => s.norad_id === selectedSatelliteId),
    [satellites, selectedSatelliteId]
  );

  const position = useMemo(
    () => positions.find((p) => p.norad_id === selectedSatelliteId),
    [positions, selectedSatelliteId]
  );

  if (!satellite) return null;

  const typeColor = getObjectTypeColor(satellite.object_type);

  return (
    <div className="glass-panel" id="object-detail">
      <div className="object-detail">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div className="object-detail__name" style={{ color: typeColor }}>
              {satellite.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop: 2,
              }}
            >
              NORAD {satellite.norad_id} · {satellite.object_type}
              {satellite.intl_designator && ` · ${satellite.intl_designator}`}
            </div>
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => selectSatellite(null)}
            style={{ padding: '4px 6px' }}
            aria-label="Close detail"
          >
            <X size={14} />
          </button>
        </div>

        {/* Current Position */}
        {position && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                color: 'var(--text-muted)',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <MapPin size={10} /> Current Position
            </div>
            <div className="object-detail__grid">
              <div className="detail-field">
                <span className="detail-field__label">Latitude</span>
                <span className="detail-field__value">{position.latitude.toFixed(4)}°</span>
              </div>
              <div className="detail-field">
                <span className="detail-field__label">Longitude</span>
                <span className="detail-field__value">{position.longitude.toFixed(4)}°</span>
              </div>
              <div className="detail-field">
                <span className="detail-field__label">Altitude</span>
                <span className="detail-field__value">{position.altitude_km.toFixed(1)} km</span>
              </div>
              <div className="detail-field">
                <span className="detail-field__label">Speed</span>
                <span className="detail-field__value">{position.speed_km_s.toFixed(2)} km/s</span>
              </div>
            </div>
          </div>
        )}

        {/* Orbital Parameters */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
              color: 'var(--text-muted)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Orbit size={10} /> Orbital Parameters
          </div>
          <div className="object-detail__grid">
            <div className="detail-field">
              <span className="detail-field__label">Inclination</span>
              <span className="detail-field__value">
                {satellite.inclination_deg?.toFixed(2) ?? '—'}°
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-field__label">Eccentricity</span>
              <span className="detail-field__value">
                {satellite.eccentricity?.toFixed(5) ?? '—'}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-field__label">Period</span>
              <span className="detail-field__value">
                {satellite.period_min?.toFixed(1) ?? '—'} min
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-field__label">Mean Motion</span>
              <span className="detail-field__value">
                {satellite.mean_motion?.toFixed(4) ?? '—'} rev/d
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-field__label">Apogee</span>
              <span className="detail-field__value">
                {satellite.apogee_km?.toFixed(1) ?? '—'} km
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-field__label">Perigee</span>
              <span className="detail-field__value">
                {satellite.perigee_km?.toFixed(1) ?? '—'} km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
