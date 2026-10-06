import { useState } from 'react';
import Alert from '../../components/Alert.jsx';
import { generateCodes, friendlyError } from '../../services/api.js';
import { downloadBlob, codesToCsv } from '../../services/format.js';

const PREVIEW_LIMIT = 300;

export default function GeneratePage() {
  const [count, setCount] = useState(100);
  const [format, setFormat] = useState('XXXX-XXXX-XXXX');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const expiresAt = expiry ? new Date(`${expiry}T23:59:59`).toISOString() : undefined;
      const res = await generateCodes({ count: Number(count), format, expiresAt });
      setResult(res.data);
    } catch (err) {
      setError(friendlyError(err, 'Could not generate codes.'));
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(result.codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setError('Copy failed. Use Download CSV instead.'); }
  }

  return (
    <>
      <h1 className="page-title">Generate codes</h1>
      <form className="card" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
        <div className="row">
          <label>Number of codes
            <input type="number" min="1" max="10000" value={count} onChange={(e) => setCount(e.target.value)} required />
          </label>
          <label>Format
            <input className="mono" value={format} onChange={(e) => setFormat(e.target.value.toUpperCase())} maxLength={64} required />
            <small>X is a random character; hyphens stay as typed.</small>
          </label>
          <label>Expiry (optional)
            <input type="date" value={expiry} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Generating…' : 'Generate codes'}</button>
      </form>

      {result && (
        <section className="card">
          <div className="result-head">
            <div>
              <h2>{result.count.toLocaleString()} codes created</h2>
              <p className="muted">Batch <span className="mono">{result.batchId}</span>. Download them now; you can also export them later from the Codes page.</p>
            </div>
            <div className="actions">
              <button className="btn" onClick={copyAll}>{copied ? 'Copied' : 'Copy all'}</button>
              <button className="btn btn-primary" onClick={() => downloadBlob(new Blob([codesToCsv(result.batchId, result.codes)], { type: 'text/csv' }), `${result.batchId}.csv`)}>Download CSV</button>
            </div>
          </div>
          <ul className="code-grid">
            {result.codes.slice(0, PREVIEW_LIMIT).map((c) => <li key={c} className="mono">{c}</li>)}
          </ul>
          {result.codes.length > PREVIEW_LIMIT && <p className="muted">Showing the first {PREVIEW_LIMIT}. The CSV contains all {result.codes.length.toLocaleString()}.</p>}
        </section>
      )}
    </>
  );
}
