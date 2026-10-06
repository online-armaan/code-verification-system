import { useEffect, useState } from 'react';
import Alert from '../../components/Alert.jsx';
import { getStats, friendlyError } from '../../services/api.js';

const CARDS = [
  { key: 'total', label: 'Total codes', tone: 'ink' },
  { key: 'unused', label: 'Unused codes', tone: 'green' },
  { key: 'used', label: 'Used codes', tone: 'blue' },
  { key: 'expired', label: 'Expired codes', tone: 'amber' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStats().then((r) => setStats(r.data.stats)).catch((e) => setError(friendlyError(e)));
  }, []);

  const pct = (n) => (stats && stats.total ? Math.round((n / stats.total) * 100) : 0);

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <Alert>{error}</Alert>
      <div className="stats">
        {CARDS.map((c) => (
          <div key={c.key} className={`stat stat-${c.tone}`}>
            <span className="stat-label">{c.label}</span>
            <span className="stat-value">{stats ? stats[c.key].toLocaleString() : '…'}</span>
          </div>
        ))}
      </div>
      {stats && stats.total > 0 && (
        <section className="card">
          <h2>Redemption progress</h2>
          <div className="bar" role="img" aria-label={`${pct(stats.used)}% used, ${pct(stats.unused)}% unused, ${pct(stats.expired)}% expired`}>
            <span className="bar-used" style={{ width: `${pct(stats.used)}%` }} />
            <span className="bar-unused" style={{ width: `${pct(stats.unused)}%` }} />
            <span className="bar-expired" style={{ width: `${pct(stats.expired)}%` }} />
          </div>
          <p className="muted">{pct(stats.used)}% used · {pct(stats.unused)}% unused · {pct(stats.expired)}% expired</p>
        </section>
      )}
      {stats && stats.total === 0 && (
        <section className="card empty">
          <h2>No codes yet</h2>
          <p>Add a single code or generate a batch from the Generate page to get started.</p>
        </section>
      )}
    </>
  );
}
