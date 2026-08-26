/**
 * Top stats bar showing key dashboard metrics.
 */

import { Shield, Satellite, AlertTriangle, Clock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatCountdown } from '../../types';

export default function StatsBar() {
  const stats = useAppStore((s) => s.stats);
  const conjunctions = useAppStore((s) => s.conjunctions);
  const alerts = useAppStore((s) => s.alerts);

  const totalObjects = stats?.total ?? 0;
  const activeConjunctions = conjunctions.length;
  const highRiskCount = alerts.length;
  const nextTCA = conjunctions.length > 0
    ? conjunctions
        .filter((c) => new Date(c.tca) > new Date())
        .sort((a, b) => new Date(a.tca).getTime() - new Date(b.tca).getTime())[0]
    : null;

  return (
    <header className="stats-bar app-header" id="stats-bar">
      <div className="stats-bar__brand">
        <Shield size={22} color="#fbbf24" />
        <div>
          <div className="stats-bar__brand-name">Orbital Shield</div>
          <div className="stats-bar__brand-tag">Collision Risk Dashboard</div>
        </div>
      </div>

      <div className="stat-card stat-card--cyan" id="stat-total-objects">
        <div className="stat-card__value">{totalObjects.toLocaleString()}</div>
        <div className="stat-card__label">
          <Satellite size={10} style={{ marginRight: 4 }} />
          Tracked Objects
        </div>
      </div>

      <div className="stat-card stat-card--gold" id="stat-conjunctions">
        <div className="stat-card__value">{activeConjunctions}</div>
        <div className="stat-card__label">
          <AlertTriangle size={10} style={{ marginRight: 4 }} />
          Conjunctions
        </div>
      </div>

      <div className="stat-card stat-card--red" id="stat-highest-risk">
        <div className="stat-card__value">{highRiskCount}</div>
        <div className="stat-card__label">High Risk</div>
      </div>

      <div className="stat-card stat-card--blue" id="stat-next-tca">
        <div className="stat-card__value">
          {nextTCA ? formatCountdown(nextTCA.tca) : '—'}
        </div>
        <div className="stat-card__label">
          <Clock size={10} style={{ marginRight: 4 }} />
          Next TCA
        </div>
      </div>
    </header>
  );
}
