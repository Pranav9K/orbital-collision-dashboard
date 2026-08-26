import { X, AlertTriangle, Crosshair, Zap, Activity } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { formatCountdown, getRiskLevel, getRiskColor } from '../../types';

export default function ConjunctionDetail() {
  const selectedConjunctionId = useAppStore((s) => s.selectedConjunctionId);
  const conjunctions = useAppStore((s) => s.conjunctions);
  const selectConjunction = useAppStore((s) => s.selectConjunction);
  const selectSatellite = useAppStore((s) => s.selectSatellite);

  const conjunction = useMemo(
    () => conjunctions.find((c) => c.id === selectedConjunctionId),
    [conjunctions, selectedConjunctionId]
  );

  if (!conjunction) return null;

  const riskLevel = getRiskLevel(conjunction.risk_score);
  const riskColor = getRiskColor(conjunction.risk_score);

  return (
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

        {/* Objects Involved */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
          <div style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>OBJECT 1</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{conjunction.object1_name || 'UNKNOWN'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>NORAD {conjunction.object1_norad_id}</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Crosshair size={16} />
          </div>

          <div style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>OBJECT 2</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-gold)' }}>{conjunction.object2_name || 'UNKNOWN'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>NORAD {conjunction.object2_norad_id}</div>
          </div>
        </div>

        {/* Technical Details */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '8px',
          marginTop: '4px'
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

      </div>
    </div>
  );
}
