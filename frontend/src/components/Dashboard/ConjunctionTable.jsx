/**
 * Sortable conjunction events table with risk badges.
 */

import { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { getRiskLevel, formatCountdown, isHighRisk } from '../../types';

export default function ConjunctionTable() {
  const conjunctions          = useAppStore((s) => s.conjunctions);
  const selectConjunction     = useAppStore((s) => s.selectConjunction);
  const selectSatellite       = useAppStore((s) => s.selectSatellite);
  const selectedConjunctionId = useAppStore((s) => s.selectedConjunctionId);
  const selectedSatelliteId   = useAppStore((s) => s.selectedSatelliteId);

  const sortField = useAppStore((s) => s.conjSortField);
  const sortAsc   = useAppStore((s) => s.conjSortAsc);
  const setSort   = useAppStore((s) => s.setConjSort);

  // Filter out high-risk events as they are classified in the High-Risk panel above
  const standardConjunctions = useMemo(() => {
    return conjunctions.filter((c) => !isHighRisk(c.risk_score));
  }, [conjunctions]);

  const sorted = useMemo(() => {
    return [...standardConjunctions].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'risk_score':       cmp = a.risk_score - b.risk_score; break;
        case 'miss_distance_km': cmp = a.miss_distance_km - b.miss_distance_km; break;
        case 'tca':              cmp = new Date(a.tca).getTime() - new Date(b.tca).getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [standardConjunctions, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) { setSort(field, !sortAsc); }
    else { setSort(field, false); }
  };

  const handleRowClick = (conj) => {
    if (selectedConjunctionId === conj.id) {
      if (selectedSatelliteId !== null) {
        // Re-locate back to the conjunction event!
        selectSatellite(null);
      } else {
        // Toggle off
        selectConjunction(null);
      }
    } else {
      // Point to conjunction event location
      selectConjunction(conj.id);
      selectSatellite(null);
    }
  };

  const handleObjectClick = (e, conjId, noradId) => {
    e.stopPropagation();
    selectConjunction(conjId);
    selectSatellite(noradId);
  };

  if (standardConjunctions.length === 0) {
    return (
      <div className="glass-panel" id="conjunction-table">
        <div className="section-header">
          <span className="section-header__title">Conjunction Events</span>
          <span className="section-header__badge">0</span>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">
            {conjunctions.length > 0
              ? 'All active events classified as High Risk above'
              : 'No conjunction events detected'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" id="conjunction-table">
      <div className="section-header">
        <span className="section-header__title">Conjunction Events</span>
        <span className="section-header__badge">{standardConjunctions.length}</span>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="conjunction-table">
          <thead>
            <tr>
              <th>Objects</th>
              <th onClick={() => handleSort('tca')} style={{ cursor: 'pointer' }}>TCA <ArrowUpDown size={10} /></th>
              <th onClick={() => handleSort('miss_distance_km')} style={{ cursor: 'pointer' }}>Distance <ArrowUpDown size={10} /></th>
              <th onClick={() => handleSort('risk_score')} style={{ cursor: 'pointer' }}>Risk <ArrowUpDown size={10} /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 50).map((conj) => {
              const level = getRiskLevel(conj.risk_score);
              const isSelected = selectedConjunctionId === conj.id;
              return (
                <tr
                  key={conj.id}
                  onClick={() => handleRowClick(conj)}
                  style={isSelected ? { background: 'rgba(0, 212, 255, 0.08)' } : undefined}
                >
                  <td>
                    <div
                      onClick={(e) => handleObjectClick(e, conj.id, conj.object1_norad_id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: selectedSatelliteId === conj.object1_norad_id ? 'var(--accent-cyan)' : '#e8edf5',
                        cursor: 'pointer',
                        display: 'inline-block',
                      }}
                      title="Click to zoom to Object 1"
                    >
                      {conj.object1_name || `#${conj.object1_norad_id}`}
                    </div>
                    <div
                      onClick={(e) => handleObjectClick(e, conj.id, conj.object2_norad_id)}
                      style={{
                        fontSize: 10,
                        color: selectedSatelliteId === conj.object2_norad_id ? 'var(--accent-gold)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="Click to zoom to Object 2"
                    >
                      ↔ {conj.object2_name || `#${conj.object2_norad_id}`}
                    </div>
                  </td>
                  <td className="mono">{formatCountdown(conj.tca)}</td>
                  <td className="mono">{conj.miss_distance_km?.toFixed(1)} km</td>
                  <td><span className={`risk-badge risk-badge--${level}`}>{conj.risk_score}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
