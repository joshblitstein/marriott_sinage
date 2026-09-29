import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  lookupPasswordReset,
  MIN_PASSWORD_LENGTH,
  requestAdminPasswordReset,
  resetPasswordWithSecondFactor,
} from '../../lib/passwordReset';

type Step = 'username' | 'totp' | 'done_admin' | 'done_reset';

export function ForgotPasswordPage() {
  const { user, configured } = useAuth();
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  async function handleUsername(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await lookupPasswordReset(username);
      if (result.status === 'totp_available') {
        setUsername(result.username);
        setStep('totp');
        return;
      }
      if (result.status === 'admin_required') {
        await requestAdminPasswordReset(result.username);
      }
      // not_found / inactive / admin_required → same generic outcome
      setStep('done_admin');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTotpReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordWithSecondFactor({
        username,
        code,
        newPassword: password,
      });
      setStep('done_reset');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg === 'INACTIVE'
          ? 'This account is inactive.'
          : msg === 'WEAK_PASSWORD'
            ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
            : 'Invalid authenticator or recovery code.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell admin-login">
      <img
        className="admin-login__logo"
        src="/brand/sheraton-logo-tungsten.png"
        alt="Sheraton"
      />
      <h1>Forgot password</h1>

      {!configured && (
        <p className="banner warning">
          Firebase credentials missing. Add them to <code>.env.local</code>.
        </p>
      )}

      {step === 'username' && (
        <>
          <p>
            Enter your username. If two-factor is enabled, you can reset your
            password with your authenticator. Otherwise a Display Hub lead will
            need to reset it for you.
          </p>
          <form
            onSubmit={(e) => void handleUsername(e)}
            className="login-form"
          >
            <label>
              Username
              <input
                type="text"
                name="username"
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
            {error && <p className="banner error">{error}</p>}
            <button type="submit" disabled={!configured || submitting}>
              {submitting ? 'Checking…' : 'Continue'}
            </button>
            <Link to="/admin/login" className="login-form__link">
              Back to sign in
            </Link>
          </form>
        </>
      )}

      {step === 'totp' && (
        <>
          <p>
            Confirm with your authenticator (or a recovery code), then choose a
            new password for <strong>{username}</strong>.
          </p>
          <form
            onSubmit={(e) => void handleTotpReset(e)}
            className="login-form"
          >
            <label>
              Authenticator or recovery code
              <input
                type="text"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={submitting}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                disabled={submitting}
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                disabled={submitting}
              />
            </label>
            {error && <p className="banner error">{error}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? 'Updating…' : 'Reset password'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={submitting}
              onClick={() => {
                setStep('username');
                setCode('');
                setPassword('');
                setConfirm('');
                setError(null);
              }}
            >
              Back
            </button>
          </form>
        </>
      )}

      {step === 'done_admin' && (
        <>
          <p className="banner success">
            If that account exists, a password reset was requested. Ask a
            Display Hub lead to open <strong>Accounts</strong> and choose{' '}
            <strong>Reset password</strong> for your user.
          </p>
          <p className="login-2fa__hint">
            Leads will see a “Reset requested” label on your account.
          </p>
          <Link to="/admin/login" className="hub-btn hub-btn--primary">
            Back to sign in
          </Link>
        </>
      )}

      {step === 'done_reset' && (
        <>
          <p className="banner success">
            Your password was updated. Sign in with your new password.
          </p>
          <Link to="/admin/login" className="hub-btn hub-btn--primary">
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}
