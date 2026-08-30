/**
 * Top stats bar showing key dashboard metrics + risk classification info button.
 */

import { useState, useEffect, useRef } from 'react';
import { Shield, Satellite, AlertTriangle, Clock, Info, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatCountdown } from '../../types';

const RISK_LEVELS = [
  { label: 'Critical', range: '75 – 100', color: '#dc2626', desc: 'Imminent collision threat. Miss distance < 1 km, high-velocity approach. Immediate operator action required.' },
  { label: 'High',     range: '50 – 74',  color: '#ef4444', desc: 'Significant risk. Miss distance 1–5 km. Evasive maneuver strongly recommended before TCA.' },
  { label: 'Medium',   range: '25 – 49',  color: '#f59e0b', desc: 'Elevated risk. Miss distance 5–15 km. Monitor closely; maneuver may be required as TCA approaches.' },
  { label: 'Low',      range: '0 – 24',   color: '#10b981', desc: 'Acceptable risk. Miss distance > 15 km. Continue nominal operations with standard monitoring.' },
];

export default function StatsBar() {
  const stats        = useAppStore((s) => s.stats);
  const conjunctions = useAppStore((s) => s.conjunctions);
  const alerts       = useAppStore((s) => s.alerts);
  const [showInfo, setShowInfo] = useState(false);
  const modalRef = useRef(null);

  const totalObjects      = stats?.total ?? 0;
  const activeConjunctions = conjunctions.length;
  const highRiskCount     = alerts.length;
  const nextTCA           = conjunctions.length > 0
    ? conjunctions
        .filter((c) => new Date(c.tca) > new Date())
        .sort((a, b) => new Date(a.tca).getTime() - new Date(b.tca).getTime())[0]
    : null;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowInfo(false);
    };
    if (showInfo) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInfo]);

  return (
    <header className="stats-bar app-header" id="stats-bar" style={{ position: 'relative', zIndex: 100 }}>
      <div className="stats-bar__brand">
        <Shield size={22} color="#fbbf24" />
        <div>
          <div className="stats-bar__brand-name">Orbital Shield</div>
          <div className="stats-bar__brand-tag">Collision Risk Dashboard</div>
        </div>
      </div>

      <div className="stat-card stat-card--cyan" id="stat-total-objects">
        <div className="stat-card__value">{totalObjects.toLocaleString()}</div>
        <div className="stat-card__label"><Satellite size={10} style={{ marginRight: 4 }} />Tracked Objects</div>
      </div>

      <div className="stat-card stat-card--gold" id="stat-conjunctions">
        <div className="stat-card__value">{activeConjunctions}</div>
        <div className="stat-card__label"><AlertTriangle size={10} style={{ marginRight: 4 }} />Conjunctions</div>
      </div>

      <div className="stat-card stat-card--red" id="stat-highest-risk">
        <div className="stat-card__value">{highRiskCount}</div>
        <div className="stat-card__label">High Risk</div>
      </div>

      <div className="stat-card stat-card--blue" id="stat-next-tca">
        <div className="stat-card__value">{nextTCA ? formatCountdown(nextTCA.tca) : '–'}</div>
        <div className="stat-card__label"><Clock size={10} style={{ marginRight: 4 }} />Next TCA</div>
      </div>

      {/* Info button */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        title="Risk classification guide"
        style={{
          marginLeft: 8,
          width: 32, height: 32,
          borderRadius: '50%',
          background: showInfo ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)',
          border: showInfo ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
          color: showInfo ? 'var(--accent-cyan)' : 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
      >
        <Info size={15} />
      </button>

      {/* Risk classification modal overlay */}
      {showInfo && (
        <>
          {/* Transparent click-outside backdrop */}
          <div
            onClick={() => setShowInfo(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Floating dropdown panel */}
          <div
            ref={modalRef}
            style={{
              position: 'fixed',
              top: 60,
              right: 20,
              width: 420,
              maxWidth: 'calc(100vw - 40px)',
              background: 'rgba(10, 15, 30, 0.98)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0,212,255,0.15)',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'slideDownStats 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(99,102,241,0.12))',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Info size={15} color="var(--accent-cyan)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Risk Score Classification</span>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 24, height: 24,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Levels */}
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RISK_LEVELS.map((lvl) => (
                <div key={lvl.label} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: `${lvl.color}10`,
                  border: `1px solid ${lvl.color}30`,
                }}>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: lvl.color,
                      boxShadow: `0 0 10px ${lvl.color}`,
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: lvl.color }}>{lvl.label}</span>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)',
                        color: lvl.color, background: `${lvl.color}20`,
                        padding: '2px 8px', borderRadius: 99, fontWeight: 700
                      }}>
                        Score {lvl.range}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{lvl.desc}</p>
                  </div>
                </div>
              ))}

              {/* Footer note */}
              <div style={{
                fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
                padding: '8px 4px 2px', borderTop: '1px solid rgba(255,255,255,0.06)',
                marginTop: 2
              }}>
                ⓘ Risk score is calculated in real-time from miss distance, relative velocity, and orbital geometry.
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideDownStats {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
}
