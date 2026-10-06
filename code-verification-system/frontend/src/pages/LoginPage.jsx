import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Alert from '../components/Alert.jsx';
import { useAuth } from '../components/AuthContext.jsx';
import { friendlyError } from '../services/api.js';

export default function LoginPage() {
  const { admin, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && admin) return <Navigate to="/admin" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(friendlyError(err, 'Could not sign in. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card login" onSubmit={onSubmit}>
        <Logo />
        <h1>Admin sign in</h1>
        <Alert>{error}</Alert>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <Link to="/" className="link-quiet">Back to code verification</Link>
      </form>
    </div>
  );
}
