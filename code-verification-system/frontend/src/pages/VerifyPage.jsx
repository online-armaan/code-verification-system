import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { verifyCode, friendlyError } from '../services/api.js';

const RESULTS = {
  valid: { icon: '✓', title: 'Code Valid', text: 'This code has been successfully verified.' },
  used: { icon: '✕', title: 'Code Already Used', text: 'This code has already been redeemed.' },
  invalid: { icon: '✕', title: 'Code Expired / Invalid', text: 'This code is not valid or has expired.' },
};

export default function VerifyPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { status } | { error }

  async function onSubmit(e) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await verifyCode(code);
      const status = res.data?.status;
      if (RESULTS[status]) setResult({ status });
      else setResult({ error: res.status === 429 ? res.data.message : 'Please enter a valid code.' });
    } catch (err) {
      setResult({ error: friendlyError(err) });
    } finally {
      setLoading(false);
    }
  }

  const shown = result?.status ? RESULTS[result.status] : null;

  return (
    <div className="public">
      <header className="public-bar">
        <Logo />
        <Link to="/admin" className="link-quiet">Admin</Link>
      </header>
      <main className="verify">
        <h1>Verify Your Code</h1>
        <p className="lede">Enter your code below to verify its authenticity.</p>

        <form onSubmit={onSubmit} className="verify-form" noValidate>
          <label htmlFor="code" className="sr-only">Code</label>
          <input
            id="code"
            className="code-input"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }}
            placeholder="ABCD-1234-EFGH"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            autoFocus
          />
          <button className="btn btn-primary btn-lg" disabled={loading || !code.trim()}>
            {loading ? <><span className="spinner spinner-sm" /> Verifying…</> : 'Verify code'}
          </button>
        </form>

        <div aria-live="polite" className="result-slot">
          {shown && (
            <section className={`result result-${result.status}`}>
              <span className="result-icon" aria-hidden="true">{shown.icon}</span>
              <div>
                <h2>{shown.title}</h2>
                <p>{shown.text}</p>
              </div>
            </section>
          )}
          {result?.error && <div className="alert alert-error" role="alert">{result.error}</div>}
        </div>
      </main>
    </div>
  );
}
