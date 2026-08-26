/**
 * Searchable, grouped list of tracked orbital objects.
 */
import { Search, Satellite, Trash2, Rocket } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor } from '../../types';
import FilterBar from '../Controls/FilterBar';

export default function ObjectList() {
  const satellites = useAppStore((s) => s.satellites);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const selectSatellite = useAppStore((s) => s.selectSatellite);
  const selectedSatelliteId = useAppStore((s) => s.selectedSatelliteId);
  const selectConjunction = useAppStore((s) => s.selectConjunction);

  const activeFilters = useAppStore((s) => s.activeFilters);

  const filtered = useMemo(() => {
    let result = satellites.filter((s) => {
      const type = s.object_type?.toUpperCase();
      if (!activeFilters.payload && (type === 'PAYLOAD' || type === 'UNKNOWN' || type === 'TBA' || !type)) return false;
      if (!activeFilters.debris && type === 'DEBRIS') return false;
      if (!activeFilters.rocketBody && type === 'ROCKET BODY') return false;
      return true;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          String(s.norad_id).includes(q) ||
          (s.intl_designator && s.intl_designator.toLowerCase().includes(q))
      );
    }
    return result;
  }, [satellites, searchQuery, activeFilters]);

  const getIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'PAYLOAD': return <Satellite size={12} />;
      case 'DEBRIS': return <Trash2 size={12} />;
      case 'ROCKET BODY': return <Rocket size={12} />;
      default: return <Satellite size={12} />;
    }
  };

  return (
    <div className="glass-panel" id="object-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="section-header">
        <span className="section-header__title">Tracked Objects</span>
        <span className="section-header__badge">{filtered.length}</span>
      </div>
      <div style={{ padding: 'var(--space-sm)', paddingTop: 0 }}>
        <FilterBar />
        <div className="search-wrapper" style={{ marginTop: 'var(--space-sm)' }}>
          <Search size={14} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or NORAD ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="satellite-search"
          />
        </div>
      </div>
      <div className="object-list" style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.slice(0, 200).map((sat) => (
          <div key={sat.norad_id} className={`object-item ${selectedSatelliteId === sat.norad_id ? 'object-item--selected' : ''}`}
            onClick={() => {
              selectSatellite(sat.norad_id);
              selectConjunction(null);
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span style={{ color: getObjectTypeColor(sat.object_type) }}>{getIcon(sat.object_type)}</span>
              <span className="object-item__name">{sat.name}</span>
            </div>
            <span className="object-item__id">{sat.norad_id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
