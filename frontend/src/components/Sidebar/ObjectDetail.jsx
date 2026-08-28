/**
 * Detail panel for a selected orbital object.
 */
import { X, MapPin, Gauge, Orbit, Info, Crosshair, Navigation } from 'lucide-react';
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
      <div className="section-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
        <span className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color }}>
          <Info size={14} /> SATELLITE DETAIL
        </span>
        <button 
          className="icon-button" 
          onClick={() => selectSatellite(null)} 
          title="Close"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>
      
      <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        
        {/* Name and ID Block */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: `linear-gradient(135deg, rgba(10,10,10,0.4), ${color}15)`,
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${color}30`
        }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>Object Name</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: color, lineHeight: 1.2, marginTop: '2px' }}>{satellite.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>NORAD ID</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{satellite.norad_id}</div>
          </div>
        </div>

        {/* Info Block */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
          <div style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>TYPE</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color }}>{satellite.object_type || 'UNKNOWN'}</div>
          </div>
          <div style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>INT'L DESIGNATOR</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>{satellite.intl_designator || '—'}</div>
          </div>
        </div>

        {position && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '8px',
            marginTop: '4px'
          }}>
            <div style={{ gridColumn: '1 / -1', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={12} /> Current Position
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Navigation size={10} /> Latitude
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {position.latitude?.toFixed(4)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>°</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Navigation size={10} /> Longitude
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {position.longitude?.toFixed(4)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>°</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Crosshair size={10} /> Altitude
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {position.altitude_km?.toFixed(1)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>km</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Gauge size={10} /> Speed
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {position.speed_km_s?.toFixed(3)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>km/s</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '8px',
          marginTop: '4px'
        }}>
          <div style={{ gridColumn: '1 / -1', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            <Orbit size={12} /> Orbital Parameters
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Inclination</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{satellite.inclination_deg?.toFixed(4)}°</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Period</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{satellite.period_min?.toFixed(2)} min</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Apogee</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{satellite.apogee_km?.toFixed(1)} km</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Perigee</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{satellite.perigee_km?.toFixed(1)} km</div>
          </div>
        </div>

      </div>
    </div>
  );
}
