export const fmtDate = (v, withTime = false) =>
  v
    ? new Date(v).toLocaleString(undefined, withTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' })
    : '—';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Quote every cell and neutralise spreadsheet formulas.
export function codesToCsv(batchId, codes) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return ['Code,Batch ID', ...codes.map((c) => `${q(c)},${q(batchId)}`)].join('\r\n');
}
