/**
 * Filter bar for toggling object type visibility.
 */
import { useAppStore } from '../../store/appStore';
import { Satellite, Trash2, Rocket } from 'lucide-react';

export default function FilterBar() {
  const activeFilters = useAppStore((s) => s.activeFilters);
  const toggleFilter = useAppStore((s) => s.toggleFilter);

  const filters = [
    { key: 'payload', label: 'Satellites', icon: Satellite, color: '#fbbf24' },
    { key: 'debris', label: 'Debris', icon: Trash2, color: '#ea580c' },
    { key: 'rocketBody', label: 'Rocket', icon: Rocket, color: '#dc2626' },
  ];

  return (
    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
      {filters.map((f) => {
        const isActive = activeFilters[f.key];
        const Icon = f.icon;
        return (
          <button
            key={f.key}
            onClick={() => toggleFilter(f.key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 0',
              borderRadius: 'var(--radius-sm)',
              border: isActive ? `1px solid ${f.color}40` : '1px solid transparent',
              background: isActive ? `${f.color}15` : 'transparent',
              color: isActive ? f.color : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? `0 0 10px ${f.color}20` : 'none'
            }}
          >
            <Icon size={12} />
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
