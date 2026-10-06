import { useEffect, useState } from 'react';
import Alert from '../../components/Alert.jsx';
import { getBatches, friendlyError } from '../../services/api.js';
import { fmtDate } from '../../services/format.js';

export default function BatchesPage() {
  const [batches, setBatches] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getBatches().then((r) => setBatches(r.data.batches)).catch((e) => setError(friendlyError(e)));
  }, []);

  return (
    <>
      <h1 className="page-title">Batches</h1>
      <Alert>{error}</Alert>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Batch ID</th><th>Codes</th><th>Used</th><th>Unused</th><th>Created</th></tr></thead>
            <tbody>
              {batches?.map((b) => (
                <tr key={b.batchId}>
                  <td className="mono">{b.batchId}</td>
                  <td>{b.total.toLocaleString()}</td>
                  <td>{b.used.toLocaleString()}</td>
                  <td>{b.unused.toLocaleString()}</td>
                  <td>{fmtDate(b.createdAt, true)}</td>
                </tr>
              ))}
              {batches && batches.length === 0 && <tr><td colSpan={5} className="empty-cell">No batches yet. Generate codes to create one.</td></tr>}
              {!batches && !error && <tr><td colSpan={5} className="empty-cell">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
