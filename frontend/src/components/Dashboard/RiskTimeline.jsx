/**
 * Risk timeline chart using Recharts.
 */
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../store/appStore';

export default function RiskTimeline() {
  const timeline = useAppStore((s) => s.timeline);

  const chartData = timeline.map((point) => ({
    time: new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    risk: point.max_risk_score,
    events: point.event_count,
  }));

  return (
    <div className="glass-panel" id="risk-timeline">
      <div className="section-header">
        <span className="section-header__title">Risk Timeline</span>
      </div>
      <div className="chart-container">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 160, 255, 0.06)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#556680', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'rgba(100, 160, 255, 0.1)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#556680', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(10, 14, 26, 0.95)', border: '1px solid rgba(100, 160, 255, 0.15)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter', color: '#e8edf5' }} />
              <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} fill="url(#riskGradient)" dot={false} activeDot={{ r: 4, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state"><div className="empty-state__text">No timeline data available</div></div>
        )}
      </div>
    </div>
  );
}
