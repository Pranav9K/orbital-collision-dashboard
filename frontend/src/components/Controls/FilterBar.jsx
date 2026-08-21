/**
 * Filter bar for toggling object type visibility.
 */
import { useAppStore } from '../../store/appStore';

export default function FilterBar() {
  const activeFilters = useAppStore((s) => s.activeFilters);
  const toggleFilter = useAppStore((s) => s.toggleFilter);

  const filters = [
    { key: 'payload', label: 'Satellites', color: '#00d4ff' },
    { key: 'debris', label: 'Debris', color: '#ef4444' },
    { key: 'rocketBody', label: 'Rocket Bodies', color: '#f59e0b' },
  ];

  return (
    <div className="filter-bar" id="filter-bar">
      {filters.map((f) => (
        <button key={f.key}
          className={`filter-chip ${activeFilters[f.key] ? 'filter-chip--active' : ''}`}
          onClick={() => toggleFilter(f.key)}
          style={activeFilters[f.key] ? { borderColor: f.color, color: f.color } : undefined}>
          <span className="filter-chip__dot" style={{ background: activeFilters[f.key] ? f.color : '#556680' }} />
          {f.label}
        </button>
      ))}
    </div>
  );
}
