/**
 * Real-time alert panel for high-risk conjunction events.
 */

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatCountdown, getRiskLevel } from '../../types';

export default function AlertPanel() {
  const alerts = useAppStore((s) => s.alerts);
  const selectConjunction = useAppStore((s) => s.selectConjunction);
  const selectSatellite = useAppStore((s) => s.selectSatellite);

  const handleAlertClick = (alert: (typeof alerts)[0]) => {
    selectConjunction(alert.id);
    selectSatellite(alert.object1_norad_id);
  };

  return (
    <div className="glass-panel" id="alert-panel">
      <div className="section-header">
        <span className="section-header__title">
          <AlertTriangle
            size={12}
            style={{ marginRight: 6, color: 'var(--risk-high)' }}
          />
          High-Risk Alerts
        </span>
        {alerts.length > 0 && (
          <span
            className="section-header__badge"
            style={{
              background: 'var(--risk-high-bg)',
              color: 'var(--risk-high)',
            }}
          >
            {alerts.length}
          </span>
        )}
      </div>
      <div
        style={{
          padding: 'var(--space-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          maxHeight: 250,
          overflowY: 'auto',
        }}
      >
        {alerts.length === 0 ? (
          <div className="empty-state">
            <div
              className="empty-state__icon"
              style={{ color: 'var(--risk-low)' }}
            >
              ✓
            </div>
            <div className="empty-state__text">
              No high-risk events detected
            </div>
          </div>
        ) : (
          alerts.map((alert) => {
            const level = getRiskLevel(alert.risk_score);
            return (
              <div
                key={alert.id}
                className="alert-item"
                onClick={() => handleAlertClick(alert)}
                style={{
                  cursor: 'pointer',
                  borderLeftColor:
                    level === 'critical'
                      ? 'var(--risk-critical)'
                      : 'var(--risk-high)',
                }}
              >
                <div className="alert-item__header">
                  <span className="alert-item__title">
                    ⚠ Risk Score: {alert.risk_score}
                  </span>
                  <span className="alert-item__countdown">
                    {formatCountdown(alert.tca)}
                  </span>
                </div>
                <div className="alert-item__detail">
                  <strong>{alert.object1_name || `#${alert.object1_norad_id}`}</strong>
                  {' '}
                  <ArrowRight size={10} style={{ verticalAlign: 'middle' }} />
                  {' '}
                  <strong>{alert.object2_name || `#${alert.object2_norad_id}`}</strong>
                </div>
                <div className="alert-item__detail">
                  Miss distance:{' '}
                  <strong>{alert.miss_distance_km?.toFixed(2)} km</strong>
                  {alert.relative_velocity_km_s && (
                    <>
                      {' · '}Vel: <strong>{alert.relative_velocity_km_s.toFixed(1)} km/s</strong>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
