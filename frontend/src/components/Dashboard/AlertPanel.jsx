/**
 * Real-time alert panel for high-risk conjunction events.
 */
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatCountdown, getRiskLevel } from '../../types';

export default function AlertPanel() {
  const alerts            = useAppStore((s) => s.alerts);
  const selectConjunction = useAppStore((s) => s.selectConjunction);
  const selectSatellite   = useAppStore((s) => s.selectSatellite);
  const selectedConjId    = useAppStore((s) => s.selectedConjunctionId);
  const selectedSatId     = useAppStore((s) => s.selectedSatelliteId);

  const handleAlertClick = (alert) => {
    if (selectedConjId === alert.id) {
      if (selectedSatId !== null) {
        // If an individual satellite was focused, locate back to the conjunction event location!
        selectSatellite(null);
      } else {
        // Toggle off
        selectConjunction(null);
      }
    } else {
      // Point directly to conjunction event location
      selectConjunction(alert.id);
      selectSatellite(null);
    }
  };

  const handleObjectClick = (e, conjId, noradId) => {
    e.stopPropagation();
    selectConjunction(conjId);
    selectSatellite(noradId);
  };

  return (
    <div className="glass-panel" id="alert-panel">
      <div className="section-header">
        <span className="section-header__title">
          <AlertTriangle size={12} style={{ marginRight: 6, color: 'var(--risk-high)' }} />
          High-Risk Alerts
        </span>
        {alerts.length > 0 && (
          <span className="section-header__badge" style={{ background: 'var(--risk-high-bg)', color: 'var(--risk-high)' }}>
            {alerts.length}
          </span>
        )}
      </div>
      <div style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: 250, overflowY: 'auto' }}>
        {alerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ color: 'var(--risk-low)' }}>✓</div>
            <div className="empty-state__text">No high-risk events detected</div>
          </div>
        ) : (
          alerts.map((alert) => {
            const level = getRiskLevel(alert.risk_score);
            const isSelected = selectedConjId === alert.id;
            return (
              <div
                key={alert.id}
                className="alert-item"
                onClick={() => handleAlertClick(alert)}
                style={{
                  cursor: 'pointer',
                  borderLeftColor: level === 'critical' ? 'var(--risk-critical)' : 'var(--risk-high)',
                  background: isSelected ? 'rgba(0, 212, 255, 0.08)' : undefined,
                  transition: 'all 0.2s ease',
                }}
                title={isSelected && selectedSatId ? 'Click to re-locate to conjunction event' : 'Click to inspect conjunction event'}
              >
                <div className="alert-item__header">
                  <span className="alert-item__title">⚠ Risk Score: {alert.risk_score}</span>
                  <span className="alert-item__countdown">{formatCountdown(alert.tca)}</span>
                </div>
                <div className="alert-item__detail" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span
                    onClick={(e) => handleObjectClick(e, alert.id, alert.object1_norad_id)}
                    style={{
                      color: selectedSatId === alert.object1_norad_id ? 'var(--accent-cyan)' : '#e8edf5',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: selectedSatId === alert.object1_norad_id ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: selectedSatId === alert.object1_norad_id ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                    title="Click to zoom directly to Object 1"
                  >
                    {alert.object1_name || `#${alert.object1_norad_id}`}
                  </span>
                  <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />
                  <span
                    onClick={(e) => handleObjectClick(e, alert.id, alert.object2_norad_id)}
                    style={{
                      color: selectedSatId === alert.object2_norad_id ? 'var(--accent-gold)' : '#e8edf5',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: selectedSatId === alert.object2_norad_id ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                      border: selectedSatId === alert.object2_norad_id ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                    title="Click to zoom directly to Object 2"
                  >
                    {alert.object2_name || `#${alert.object2_norad_id}`}
                  </span>
                </div>
                <div className="alert-item__detail" style={{ marginTop: '4px' }}>
                  Miss distance: <strong>{alert.miss_distance_km?.toFixed(2)} km</strong>
                  {alert.relative_velocity_km_s && (<> · Vel: <strong>{alert.relative_velocity_km_s.toFixed(1)} km/s</strong></>)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
