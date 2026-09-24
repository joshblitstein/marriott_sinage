import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const {
    user,
    signIn,
    verifyTotp,
    cancelTotp,
    totpPendingUsername,
    configured,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/admin';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const awaitingTotp = Boolean(totpPendingUsername);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(username, password);
      if (result === 'ok') {
        navigate(from, { replace: true });
      } else {
        setTotpCode('');
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'INACTIVE'
          ? 'This account is inactive.'
          : 'Invalid username or password.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyTotp(totpCode);
      navigate(from, { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'TOTP_EXPIRED'
          ? 'This sign-in expired. Enter your password again.'
          : 'Invalid authenticator or recovery code.',
      );
      if (code === 'TOTP_EXPIRED') {
        cancelTotp();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell admin-login">
      <h1>Signage Admin</h1>
      <p>
        {awaitingTotp
          ? 'Enter the 6-digit code from your authenticator app.'
          : 'Sign in to manage rooms and events.'}
      </p>

      {!configured && (
        <p className="banner warning">
          Firebase credentials missing. Add them to <code>.env.local</code>.
        </p>
      )}

      {!awaitingTotp ? (
        <form onSubmit={(e) => void handlePassword(e)} className="login-form">
          <label>
            Username
            <input
              type="text"
              name="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={!configured || submitting}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!configured || submitting}
            />
          </label>
          {error && <p className="banner error">{error}</p>}
          <button type="submit" disabled={!configured || submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void handleTotp(e)} className="login-form">
          <p className="login-2fa__user">
            Signing in as <strong>{totpPendingUsername}</strong>
          </p>
          <label>
            Authenticator code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
              disabled={submitting}
            />
          </label>
          <p className="login-2fa__hint">
            Or paste a recovery code if you lost access to your authenticator.
          </p>
          {error && <p className="banner error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={submitting}
            onClick={() => {
              cancelTotp();
              setTotpCode('');
              setError(null);
            }}
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}
