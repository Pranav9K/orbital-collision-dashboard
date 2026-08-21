/**
 * Main application layout.
 *
 * Full-viewport globe as background with glassmorphism panels overlaid:
 *   Top: StatsBar
 *   Left: Sidebar (FilterBar + ObjectList + ObjectDetail)
 *   Right: AlertPanel + ConjunctionTable
 *   Center: GlobeView (fills viewport behind panels)
 *   Bottom: TimeControls (spanning full width, with RiskTimeline embedded)
 */

import { useEffect } from 'react';
import { useAppStore } from './store/appStore';

import GlobeView from './components/Globe/GlobeView';
import StatsBar from './components/Dashboard/StatsBar';
import ConjunctionTable from './components/Dashboard/ConjunctionTable';
import RiskTimeline from './components/Dashboard/RiskTimeline';
import AlertPanel from './components/Dashboard/AlertPanel';
import ObjectList from './components/Sidebar/ObjectList';
import ObjectDetail from './components/Sidebar/ObjectDetail';
import TimeControls from './components/Controls/TimeControls';
import FilterBar from './components/Controls/FilterBar';

export default function App() {
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);
  const loadInitialData = useAppStore((s) => s.loadInitialData);
  const refreshPositions = useAppStore((s) => s.refreshPositions);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Auto-refresh positions every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPositions();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <div className="loading-text">Initializing orbital data...</div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
          }}
        >
          Fetching TLEs from CelesTrak · Propagating orbits · Screening conjunctions
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-overlay">
        <div style={{ color: 'var(--risk-high)', fontSize: 16, fontWeight: 600 }}>
          ⚠ Connection Error
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 400, textAlign: 'center' }}>
          {error}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
          Make sure the Flask backend is running on <code style={{ color: 'var(--accent-cyan)' }}>localhost:5000</code>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => loadInitialData()}
          style={{ marginTop: 16 }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="app-layout" id="app-root">
      {/* Top Stats Bar */}
      <StatsBar />

      {/* Left Sidebar */}
      <aside className="app-sidebar">
        <FilterBar />
        <ObjectList />
        <ObjectDetail />
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
    </div>
  );
}
