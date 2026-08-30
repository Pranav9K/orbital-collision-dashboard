import { X, AlertTriangle, Crosshair, Zap, Activity, Navigation, MapPin, Gauge, Orbit, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { formatCountdown, getRiskLevel, getRiskColor, getObjectTypeColor } from '../../types';
import ManeuverModal from './ManeuverModal';

export default function ConjunctionDetail() {
  const selectedConjunctionId = useAppStore((s) => s.selectedConjunctionId);
  const selectedSatelliteId   = useAppStore((s) => s.selectedSatelliteId);
  const conjunctions          = useAppStore((s) => s.conjunctions);
  const satellites            = useAppStore((s) => s.satellites);
  const positions             = useAppStore((s) => s.positions);
  const selectConjunction     = useAppStore((s) => s.selectConjunction);
  const selectSatellite       = useAppStore((s) => s.selectSatellite);
  const [showManeuver, setShowManeuver] = useState(false);

  const conjunction = useMemo(
    () => conjunctions.find((c) => c.id === selectedConjunctionId),
    [conjunctions, selectedConjunctionId]
  );

  const obj1Norad = conjunction?.object1_norad_id;
  const obj2Norad = conjunction?.object2_norad_id;

  const obj1Pos = useMemo(() => positions.find((p) => p.norad_id === obj1Norad), [positions, obj1Norad]);
  const obj1Sat = useMemo(() => satellites.find((s) => s.norad_id === obj1Norad), [satellites, obj1Norad]);

  const obj2Pos = useMemo(() => positions.find((p) => p.norad_id === obj2Norad), [positions, obj2Norad]);
  const obj2Sat = useMemo(() => satellites.find((s) => s.norad_id === obj2Norad), [satellites, obj2Norad]);

  if (!conjunction) return null;

  const riskLevel = getRiskLevel(conjunction.risk_score);
  const riskColor = getRiskColor(conjunction.risk_score);

  const isObj1Selected = selectedSatelliteId === obj1Norad;
  const isObj2Selected = selectedSatelliteId === obj2Norad;
  const activeFocusSat = isObj1Selected ? { pos: obj1Pos, sat: obj1Sat, name: conjunction.object1_name, norad: obj1Norad, num: 1, color: 'var(--accent-cyan)' }
                       : isObj2Selected ? { pos: obj2Pos, sat: obj2Sat, name: conjunction.object2_name, norad: obj2Norad, num: 2, color: 'var(--accent-gold)' }
                       : null;

  const handleObjectClick = (noradId) => {
    if (selectedSatelliteId === noradId) {
      // Toggle off individual focus, re-focus entire conjunction
      selectSatellite(null);
    } else {
      selectSatellite(noradId);
    }
  };

  return (
    <>
      <div className="glass-panel" id="conjunction-detail">
        <div className="section-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
          <span className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: riskColor }}>
            <AlertTriangle size={14} /> CONJUNCTION ALERT
          </span>
          <button
            className="icon-button"
            onClick={() => {
              selectConjunction(null);
              selectSatellite(null);
            }}
            title="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {/* Risk Score Highlight */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: `linear-gradient(135deg, rgba(10,10,10,0.4), ${riskColor}15)`,
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${riskColor}30`,
            boxShadow: riskLevel === 'critical' || riskLevel === 'high' ? `0 0 20px ${riskColor}20` : 'none'
          }}>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>Risk Score</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: riskColor, lineHeight: 1 }}>{conjunction.risk_score}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>Time to Closest Approach</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCountdown(conjunction.tca)}</div>
            </div>
          </div>

          {/* Clickable Objects Involved with Hover/Focus state */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Objects Involved</span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '9px' }}>Click object to inspect & zoom</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
              {/* Object 1 Card */}
              <div
                onClick={() => handleObjectClick(obj1Norad)}
                style={{
                  flex: 1,
                  background: isObj1Selected ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255,255,255,0.02)',
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: isObj1Selected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isObj1Selected ? '0 0 12px rgba(0, 212, 255, 0.3)' : 'none',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                title="Click to zoom & inspect Object 1 on globe"
              >
                <div style={{ fontSize: '9px', color: isObj1Selected ? 'var(--accent-cyan)' : 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                  OBJECT 1 {isObj1Selected && '• FOCUSING'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conjunction.object1_name || 'UNKNOWN'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  NORAD {conjunction.object1_norad_id}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <Crosshair size={14} />
              </div>

              {/* Object 2 Card */}
              <div
                onClick={() => handleObjectClick(obj2Norad)}
                style={{
                  flex: 1,
                  background: isObj2Selected ? 'rgba(251, 191, 36, 0.12)' : 'rgba(255,255,255,0.02)',
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: isObj2Selected ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isObj2Selected ? '0 0 12px rgba(251, 191, 36, 0.3)' : 'none',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                title="Click to zoom & inspect Object 2 on globe"
              >
                <div style={{ fontSize: '9px', color: isObj2Selected ? 'var(--accent-gold)' : 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                  OBJECT 2 {isObj2Selected && '• FOCUSING'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conjunction.object2_name || 'UNKNOWN'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  NORAD {conjunction.object2_norad_id}
                </div>
              </div>
            </div>
          </div>

          {/* Active Focused Satellite Telemetry Panel */}
          {activeFocusSat && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: `1px solid ${activeFocusSat.color}50`,
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              animation: 'slideUpFade 0.2s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: activeFocusSat.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={11} /> {activeFocusSat.name} Telemetry
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>
                  {activeFocusSat.pos?.object_type || activeFocusSat.sat?.object_type || 'ORBITAL OBJECT'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>ALTITUDE</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#e8edf5' }}>
                    {activeFocusSat.pos?.altitude_km ? `${activeFocusSat.pos.altitude_km.toFixed(1)} km` : '--'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>VELOCITY</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#e8edf5' }}>
                    {activeFocusSat.pos?.speed_km_s ? `${activeFocusSat.pos.speed_km_s.toFixed(2)} km/s` : '--'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>LAT / LON</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#e8edf5' }}>
                    {activeFocusSat.pos?.latitude ? `${activeFocusSat.pos.latitude.toFixed(2)}°, ${activeFocusSat.pos.longitude.toFixed(2)}°` : '--'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>INCLINATION</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#e8edf5' }}>
                    {activeFocusSat.sat?.inclination_deg ? `${activeFocusSat.sat.inclination_deg.toFixed(2)}°` : '--'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Technical Details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
          }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Crosshair size={10} /> Miss Distance
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {conjunction.miss_distance_km?.toFixed(2)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>km</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Zap size={10} /> Rel. Velocity
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {conjunction.relative_velocity_km_s?.toFixed(2) || '--'} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>km/s</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Activity size={10} /> Collision Probability
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {conjunction.risk_probability != null ? (conjunction.risk_probability * 100).toExponential(2) : '--'} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>%</span>
              </div>
            </div>
          </div>

          {/* Evasive Maneuver Button */}
          <button
            className="btn btn--primary"
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            onClick={() => setShowManeuver(true)}
          >
            <Navigation size={14} />
            Suggest Evasive Maneuver
          </button>

        </div>
      </div>

      {showManeuver && (
        <ManeuverModal conjunction={conjunction} onClose={() => setShowManeuver(false)} />
      )}
    </>
  );
}
