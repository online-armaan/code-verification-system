import { useState } from 'react';
import Alert from '../../components/Alert.jsx';
import { useAuth } from '../../components/AuthContext.jsx';
import { changePassword, friendlyError } from '../../services/api.js';

export default function SettingsPage() {
  const { admin } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setOk('');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setOk('Password updated.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(friendlyError(err, 'Could not update the password.'));
    } finally { setBusy(false); }
  }

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <form className="card narrow" onSubmit={onSubmit}>
        <h2>Account</h2>
        <p className="muted">Signed in as <strong>{admin?.email}</strong></p>
        <Alert>{error}</Alert>
        <Alert kind="success">{ok}</Alert>
        <label>Current password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>New password
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required />
          <small>At least 10 characters.</small>
        </label>
        <label>Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </>
  );
}
