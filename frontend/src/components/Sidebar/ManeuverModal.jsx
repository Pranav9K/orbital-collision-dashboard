/**
 * ManeuverModal - Displays the evasive maneuver recommendation for a conjunction event.
 * Shows Delta-V, burn direction, timing, fuel cost, and feasibility.
 */
import { useState, useEffect } from 'react';
import { X, Zap, Target, Clock, Fuel, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { fetchManeuver } from '../../api/client';

function DeltaVGauge({ value, max = 50 }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct < 30 ? 'var(--risk-low)' : pct < 70 ? 'var(--risk-medium)' : 'var(--risk-high)';
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>0 m/s</span>
        <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800 }}>
          {value.toFixed(3)} <span style={{ fontSize: 11, fontWeight: 400 }}>m/s</span>
        </span>
        <span>{max} m/s</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 4,
          background: `linear-gradient(90deg, var(--accent-cyan), ${color})`,
          boxShadow: `0 0 12px ${color}60`,
          transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, unit, highlight }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.025)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <Icon size={13} />
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: highlight || 'var(--text-primary)' }}>
        {value} {unit && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function ManeuverModal({ conjunction, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leadTime, setLeadTime] = useState(60);
  const [targetMiss, setTargetMiss] = useState(5);

  const runComputation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManeuver(conjunction.id, {
        target_miss_km: targetMiss,
        burn_lead_time_min: leadTime,
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runComputation(); }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 'var(--z-modal)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      animation: 'fadeIn 0.2s ease',
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflowY: 'auto',
        padding: 0,
        animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(99,102,241,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} color="var(--accent-cyan)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Evasive Maneuver</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Collision Avoidance Recommendation</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Parameters */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Lead Time
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input type="range" min={5} max={360} step={5} value={leadTime}
                  onChange={e => setLeadTime(Number(e.target.value))}
                  className="time-slider" style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-cyan)', minWidth: 40 }}>{leadTime}m</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Target Miss
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input type="range" min={1} max={25} step={0.5} value={targetMiss}
                  onChange={e => setTargetMiss(Number(e.target.value))}
                  className="time-slider" style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-cyan)', minWidth: 50 }}>{targetMiss} km</span>
              </div>
            </div>
            <button onClick={runComputation} className="btn btn--primary" style={{ alignSelf: 'flex-end', height: 34, padding: '0 14px', fontSize: 11 }}>
              Recalculate
            </button>
          </div>

          {/* Result */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: 'var(--text-muted)' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Computing orbital mechanics...</span>
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: 'var(--risk-high-bg)', borderRadius: 'var(--radius-md)', color: 'var(--risk-high)', fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {result && !loading && (
            <>
              {/* Feasibility banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: result.feasible ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${result.feasible ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {result.feasible
                  ? <CheckCircle2 size={16} color="var(--risk-low)" />
                  : <XCircle size={16} color="var(--risk-high)" />}
                <span style={{ fontSize: 12, color: result.feasible ? 'var(--risk-low)' : 'var(--risk-high)', fontWeight: 600 }}>
                  {result.reason}
                </span>
              </div>

              {result.delta_v_m_s !== null && result.delta_v_m_s > 0 && (
                <>
                  {/* Objects */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12 }}>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{result.maneuvering_object}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>MANEUVERS</div>
                    </div>
                    <ArrowRight size={16} color="var(--text-muted)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{result.threat_object}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>THREAT</div>
                    </div>
                  </div>

                  {/* Delta-V gauge */}
                  <div style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                      Required Delta-V Burn
                    </div>
                    <DeltaVGauge value={result.delta_v_m_s} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>Direction: <strong style={{ color: 'var(--accent-cyan)' }}>{result.burn_direction}</strong></span>
                      <span>Lead Time: <strong style={{ color: 'var(--accent-cyan)' }}>{result.burn_lead_time_min} min before TCA</strong></span>
                    </div>
                  </div>

                  {/* Miss distance improvement */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>CURRENT MISS</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--risk-high)' }}>{result.current_miss_km.toFixed(2)} <span style={{ fontSize: 10 }}>km</span></div>
                    </div>
                    <div style={{ color: 'var(--risk-low)', fontSize: 18 }}>→</div>
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>POST-MANEUVER</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--risk-low)' }}>{result.predicted_miss_km.toFixed(2)} <span style={{ fontSize: 10 }}>km</span></div>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <InfoRow icon={Clock} label="Optimal Burn Time (UTC)" value={result.burn_time_utc ? result.burn_time_utc.split('.')[0].replace('T','  ') : '--'} highlight="var(--accent-cyan)" />
                    <InfoRow icon={Target} label="Orbital Altitude" value={result.orbital_altitude_km?.toFixed(0)} unit="km" />
                    <InfoRow icon={Zap} label="Orbital Velocity" value={result.orbital_velocity_km_s?.toFixed(3)} unit="km/s" />
                    <InfoRow icon={Fuel} label="Est. Propellant Used" value={result.fuel_mass_kg?.toFixed(4)} unit="kg" highlight="var(--accent-gold)" />
                  </div>

                  {/* Fine print */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                    ⚙ Computed via Clohessy-Wiltshire (Hill's) equations. Assumes {result.assumed_sat_mass_kg} kg satellite, {result.isp_s}s Isp hydrazine propulsion. Fuel estimate via Tsiolkovsky Rocket Equation. For operational use, consult Flight Dynamics Officer.
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}

