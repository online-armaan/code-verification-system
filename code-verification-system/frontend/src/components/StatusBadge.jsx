const LABELS = { unused: 'Valid / unused', used: 'Used', expired: 'Expired' };

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
