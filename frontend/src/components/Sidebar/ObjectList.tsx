/**
 * Searchable, grouped list of tracked orbital objects.
 */

import { Search, Satellite, Trash2, Rocket } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';

export default function ObjectList() {
  const satellites = useAppStore((s) => s.satellites);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const selectedSatelliteId = useAppStore((s) => s.selectedSatelliteId);
  const selectSatellite = useAppStore((s) => s.selectSatellite);
  const activeFilters = useAppStore((s) => s.activeFilters);

  // Filter and search
  const filtered = useMemo(() => {
    let result = satellites;

    // Apply type filters
    result = result.filter((s) => {
      const type = s.object_type?.toUpperCase();
      if (type === 'PAYLOAD' && !activeFilters.payload) return false;
      if (type === 'DEBRIS' && !activeFilters.debris) return false;
      if (type === 'ROCKET BODY' && !activeFilters.rocketBody) return false;
      return true;
    });

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          String(s.norad_id).includes(q)
      );
    }

    return result.slice(0, 200); // Cap for performance
  }, [satellites, searchQuery, activeFilters]);

  // Group by type
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const sat of filtered) {
      const type = sat.object_type || 'UNKNOWN';
      if (!groups[type]) groups[type] = [];
      groups[type].push(sat);
    }
    return groups;
  }, [filtered]);

  const getTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PAYLOAD':
        return <Satellite size={12} color="var(--color-payload)" />;
      case 'DEBRIS':
        return <Trash2 size={12} color="var(--color-debris)" />;
      case 'ROCKET BODY':
        return <Rocket size={12} color="var(--color-rocket-body)" />;
      default:
        return <Satellite size={12} color="var(--color-unknown)" />;
    }
  };

  const getDotClass = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PAYLOAD': return 'object-item__dot--payload';
      case 'DEBRIS': return 'object-item__dot--debris';
      case 'ROCKET BODY': return 'object-item__dot--rocket';
      default: return '';
    }
  };

  return (
    <div className="glass-panel" id="object-list">
      <div className="section-header">
        <span className="section-header__title">Tracked Objects</span>
        <span className="section-header__badge">{satellites.length}</span>
      </div>

      <div style={{ padding: '0 var(--space-md) var(--space-sm)' }}>
        <div className="search-wrapper">
          <Search size={14} />
          <input
            className="search-input"
            type="text"
            placeholder="Search by name or NORAD ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="satellite-search"
          />
        </div>
      </div>

      <div className="object-list">
        {Object.entries(grouped).map(([type, sats]) => (
          <div key={type}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                color: 'var(--text-muted)',
              }}
            >
              {getTypeIcon(type)}
              {type} ({sats.length})
            </div>
            {sats.map((sat) => (
              <div
                key={sat.norad_id}
                className={`object-item ${
                  selectedSatelliteId === sat.norad_id
                    ? 'object-item--selected'
                    : ''
                }`}
                onClick={() => selectSatellite(sat.norad_id)}
              >
                <div className={`object-item__dot ${getDotClass(sat.object_type)}`} />
                <span className="object-item__name">{sat.name}</span>
                <span className="object-item__id">{sat.norad_id}</span>
              </div>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__text">No objects match your search</div>
          </div>
        )}
      </div>
    </div>
  );
}
