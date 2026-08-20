/**
 * Filter bar for toggling object type visibility.
 */

import { useAppStore } from '../../store/appStore';

export default function FilterBar() {
  const activeFilters = useAppStore((s) => s.activeFilters);
  const toggleFilter = useAppStore((s) => s.toggleFilter);
  const stats = useAppStore((s) => s.stats);

  const payloadCount = stats?.by_type?.['PAYLOAD'] ?? 0;
  const debrisCount = stats?.by_type?.['DEBRIS'] ?? 0;
  const rocketCount = stats?.by_type?.['ROCKET BODY'] ?? 0;

  return (
    <div className="glass-panel-sm" id="filter-bar">
      <div className="filter-bar">
        <button
          className={`filter-chip ${activeFilters.payload ? 'filter-chip--active' : ''}`}
          onClick={() => toggleFilter('payload')}
          id="filter-payload"
        >
          <span
            className="filter-chip__dot"
            style={{ background: 'var(--color-payload)' }}
          />
          Satellites {payloadCount > 0 && `(${payloadCount})`}
        </button>

        <button
          className={`filter-chip ${activeFilters.debris ? 'filter-chip--active' : ''}`}
          onClick={() => toggleFilter('debris')}
          id="filter-debris"
        >
          <span
            className="filter-chip__dot"
            style={{ background: 'var(--color-debris)' }}
          />
          Debris {debrisCount > 0 && `(${debrisCount})`}
        </button>

        <button
          className={`filter-chip ${activeFilters.rocketBody ? 'filter-chip--active' : ''}`}
          onClick={() => toggleFilter('rocketBody')}
          id="filter-rocket"
        >
          <span
            className="filter-chip__dot"
            style={{ background: 'var(--color-rocket-body)' }}
          />
          Rocket Bodies {rocketCount > 0 && `(${rocketCount})`}
        </button>
      </div>
    </div>
  );
}
