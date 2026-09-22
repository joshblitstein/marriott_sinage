import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const { user, signIn, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/admin';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password);
      navigate(from, { replace: true });
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

  return (
    <div className="app-shell admin-login">
      <h1>Signage Admin</h1>
      <p>Sign in to manage rooms and events.</p>

      {!configured && (
        <p className="banner warning">
          Firebase credentials missing. Add them to <code>.env.local</code>.
        </p>
      )}

      <form onSubmit={handleSubmit} className="login-form">
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
    </div>
  );
}
