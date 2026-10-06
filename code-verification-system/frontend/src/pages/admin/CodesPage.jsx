import { useCallback, useEffect, useState } from 'react';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { getCodes, addCode, deleteCode, exportCodes, friendlyError } from '../../services/api.js';
import { fmtDate, downloadBlob } from '../../services/format.js';

export default function CodesPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [newCode, setNewCode] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCodes({ page, limit: 15, search: search || undefined, status: status || undefined });
      setRows(res.data.codes);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  async function onAdd(e) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    setNotice('');
    try {
      const expiresAt = newExpiry ? new Date(`${newExpiry}T23:59:59`).toISOString() : undefined;
      const res = await addCode({ code: newCode, expiresAt });
      setNotice(`Added ${res.data.code.code}.`);
      setNewCode('');
      setNewExpiry('');
      setPage(1);
      load();
    } catch (err) {
      setAddError(friendlyError(err, 'Could not add the code.'));
    } finally {
      setAdding(false);
    }
  }

  async function onDelete(row) {
    if (!window.confirm(`Delete ${row.code}? This cannot be undone.`)) return;
    setNotice('');
    try {
      await deleteCode(row.id);
      setNotice(`Deleted ${row.code}.`);
      load();
    } catch (err) {
      setError(friendlyError(err, 'Could not delete the code.'));
    }
  }

  async function onExport() {
    try {
      const res = await exportCodes({ search: search || undefined, status: status || undefined });
      downloadBlob(res.data, `codes-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setError(friendlyError(err, 'Export failed.'));
    }
  }

  return (
    <>
      <h1 className="page-title">Codes</h1>

      <form className="card form-row" onSubmit={onAdd}>
        <h2>Add New Code</h2>
        <Alert>{addError}</Alert>
        <div className="row">
          <label className="grow">Code
            <input className="mono" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="ABCD-1234-EFGH" required maxLength={64} autoComplete="off" />
          </label>
          <label>Expiry (optional)
            <input type="date" value={newExpiry} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => setNewExpiry(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={adding || !newCode.trim()}>{adding ? 'Adding…' : 'Add code'}</button>
        </div>
      </form>

      <section className="card">
        <div className="toolbar">
          <input type="search" className="grow" placeholder="Search by code or batch" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search codes" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="unused">Unused</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
          <button className="btn" onClick={onExport}>Export CSV</button>
        </div>
        <Alert kind="success">{notice}</Alert>
        <Alert>{error}</Alert>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Code</th><th>Status</th><th>Created</th><th>Used</th><th>Expires</th><th>Batch ID</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.code}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>{fmtDate(r.usedAt, true)}</td>
                  <td>{fmtDate(r.expiresAt)}</td>
                  <td className="mono">{r.batchId || '—'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => onDelete(r)}>Delete</button></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">{search || status ? 'No codes match these filters.' : 'No codes yet. Add one above or generate a batch.'}</td></tr>
              )}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="empty-cell">Loading…</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <span className="muted">{pagination.total.toLocaleString()} code{pagination.total === 1 ? '' : 's'}</span>
          <div>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="pager-info">Page {pagination.page} of {pagination.pages}</span>
            <button className="btn btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </section>
    </>
  );
}
