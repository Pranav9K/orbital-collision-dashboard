/**
 * Main application layout.
 *
 * Full-viewport globe as background with glassmorphism panels overlaid.
 * ObjectDetail / ConjunctionDetail float over the globe as overlays.
 */

import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';

import GlobeView from './components/Globe/GlobeView';
import StatsBar from './components/Dashboard/StatsBar';
import { Shield } from 'lucide-react';
import ConjunctionTable from './components/Dashboard/ConjunctionTable';
import RiskTimeline from './components/Dashboard/RiskTimeline';
import AlertPanel from './components/Dashboard/AlertPanel';
import ObjectList from './components/Sidebar/ObjectList';
import ObjectDetail from './components/Sidebar/ObjectDetail';
import ConjunctionDetail from './components/Sidebar/ConjunctionDetail';
import TimeControls from './components/Controls/TimeControls';

export default function App() {
  const isLoading            = useAppStore((s) => s.isLoading);
  const loadingProgress      = useAppStore((s) => s.loadingProgress);
  const loadingMessage       = useAppStore((s) => s.loadingMessage);
  const error                = useAppStore((s) => s.error);
  const loadInitialData      = useAppStore((s) => s.loadInitialData);
  const refreshPositions     = useAppStore((s) => s.refreshPositions);
  const selectedConjunctionId = useAppStore((s) => s.selectedConjunctionId);
  const selectedSatelliteId  = useAppStore((s) => s.selectedSatelliteId);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => {
    const interval = setInterval(() => refreshPositions(), 30000);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  const showDetailOverlay = selectedConjunctionId || selectedSatelliteId;

  if (isLoading) {
    return (
      <div className="loading-overlay" style={{ background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', zIndex: 9999, position: 'fixed' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <Shield size={36} color="var(--accent-cyan)" />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '2px', textTransform: 'uppercase' }}>Orbital Shield</div>
        </div>
        <div style={{ width: '300px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden', height: '6px', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ height: '100%', width: `${loadingProgress}%`, background: 'var(--accent-cyan)', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 10px var(--accent-cyan)' }} />
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.5px' }}>
          {loadingMessage || 'Initializing orbital data...'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{Math.round(loadingProgress)}% Complete</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-overlay">
        <div style={{ color: 'var(--risk-high)', fontSize: 16, fontWeight: 600 }}>⚠ Connection Error</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 400, textAlign: 'center' }}>{error}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
          Make sure the Flask backend is running on <code style={{ color: 'var(--accent-cyan)' }}>localhost:5000</code>
        </div>
        <button className="btn btn--primary" onClick={() => loadInitialData()} style={{ marginTop: 16 }}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="app-layout" id="app-root">
      {/* Top Stats Bar */}
      <StatsBar />

      {/* Left Sidebar — only the object list, no detail card */}
      <aside className="app-sidebar">
        <ObjectList />
      </aside>

      {/* Center Globe */}
      <GlobeView />

      {/* Right Panel */}
      <aside className="app-right">
        <AlertPanel />
        <ConjunctionTable />
        <RiskTimeline />
      </aside>

      {/* Bottom Time Controls */}
      <TimeControls />

      {/* Floating Detail Overlay — anchored over the globe, bottom-left */}
      {showDetailOverlay && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: 330,
          width: 340,
          zIndex: 20,
          animation: 'slideUpFade 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {selectedConjunctionId ? <ConjunctionDetail /> : <ObjectDetail />}
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
