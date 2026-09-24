import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { db } from '../../lib/firebase';
import { hashPassword } from '../../lib/password';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCodes,
  totpQrDataUrl,
  verifyTotpCode,
} from '../../lib/totp';

type Step = 'idle' | 'setup' | 'recovery' | 'disable';

export function SecurityPage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.id));
        if (cancelled) return;
        const data = snap.data();
        setEnabled(Boolean(data?.totpEnabled && data?.totpSecret));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function startSetup() {
    if (!user) return;
    setError(null);
    setOk(null);
    const nextSecret = generateTotpSecret();
    const qr = await totpQrDataUrl(nextSecret, user.username);
    setSecret(nextSecret);
    setQrUrl(qr);
    setConfirmCode('');
    setStep('setup');
  }

  async function confirmSetup() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (!verifyTotpCode(secret, confirmCode)) {
        throw new Error('That code is not valid. Try the newest 6-digit code.');
      }
      const codes = generateRecoveryCodes();
      const hashes = await hashRecoveryCodes(codes);
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.id), {
        totpEnabled: true,
        totpSecret: secret,
        totpRecoveryHashes: hashes,
        updatedAt: now,
      });
      await writeAuditLog(db, {
        actor: user,
        action: 'account.2fa_enable',
        entityType: 'account',
        entityId: user.id,
        status: 'live',
        summary: `Enabled two-factor authentication for “${user.username}”`,
        detail: { targetUsername: user.username },
      });
      setEnabled(true);
      setRecoveryCodes(codes);
      setStep('recovery');
      setOk('Two-factor authentication is on.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable 2FA');
    } finally {
      setBusy(false);
    }
  }

  async function disable2FA() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'users', user.id));
      const data = snap.data();
      if (!data) throw new Error('Account not found.');
      const passwordHash = await hashPassword(password);
      if (data.passwordHash !== passwordHash) {
        throw new Error('Password is incorrect.');
      }
      if (data.totpEnabled && data.totpSecret) {
        if (!verifyTotpCode(String(data.totpSecret), confirmCode)) {
          throw new Error('Authenticator code is incorrect.');
        }
      }
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.id), {
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryHashes: [],
        updatedAt: now,
      });
      await writeAuditLog(db, {
        actor: user,
        action: 'account.2fa_disable',
        entityType: 'account',
        entityId: user.id,
        status: 'live',
        summary: `Disabled two-factor authentication for “${user.username}”`,
        detail: { targetUsername: user.username },
      });
      setEnabled(false);
      setStep('idle');
      setPassword('');
      setConfirmCode('');
      setOk('Two-factor authentication is off.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable 2FA');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <section className="security-page">
      <header className="security-page__header">
        <h1>Security</h1>
        <p>
          Protect your account with an authenticator app (Google Authenticator,
          1Password, Authy, and similar).
        </p>
      </header>

      {loading ? (
        <p className="meta">Loading…</p>
      ) : (
        <>
          {error && <p className="banner error">{error}</p>}
          {ok && <p className="banner success">{ok}</p>}

          <div className="security-card">
            <div className="security-card__row">
              <div>
                <h2>Two-factor authentication</h2>
                <p>
                  {enabled
                    ? 'Enabled. Sign-in requires your password plus a code from your authenticator.'
                    : 'Not enabled. Turn this on to require a second step after your password.'}
                </p>
              </div>
              <span
                className={
                  enabled
                    ? 'accounts-status accounts-status--active'
                    : 'accounts-status accounts-status--off'
                }
              >
                {enabled ? 'On' : 'Off'}
              </span>
            </div>

            {step === 'idle' && (
              <div className="security-card__actions">
                {!enabled ? (
                  <button
                    type="button"
                    className="hub-btn hub-btn--primary"
                    onClick={() => void startSetup()}
                  >
                    Set up 2FA
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hub-btn hub-btn--soft"
                    onClick={() => {
                      setStep('disable');
                      setError(null);
                      setOk(null);
                      setPassword('');
                      setConfirmCode('');
                    }}
                  >
                    Turn off 2FA
                  </button>
                )}
              </div>
            )}

            {step === 'setup' && (
              <div className="security-setup">
                <ol className="security-setup__steps">
                  <li>Open your authenticator app and add a new account.</li>
                  <li>Scan this QR code (or enter the key manually).</li>
                  <li>Enter the 6-digit code to confirm.</li>
                </ol>
                {qrUrl && (
                  <img
                    className="security-setup__qr"
                    src={qrUrl}
                    alt="Authenticator QR code"
                  />
                )}
                <p className="security-setup__key">
                  Manual key: <code>{secret}</code>
                </p>
                <label>
                  Confirmation code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    placeholder="123456"
                  />
                </label>
                <div className="security-card__actions">
                  <button
                    type="button"
                    className="hub-btn hub-btn--primary"
                    disabled={busy || confirmCode.trim().length < 6}
                    onClick={() => void confirmSetup()}
                  >
                    {busy ? 'Enabling…' : 'Enable 2FA'}
                  </button>
                  <button
                    type="button"
                    className="hub-btn hub-btn--soft"
                    disabled={busy}
                    onClick={() => setStep('idle')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {step === 'recovery' && recoveryCodes && (
              <div className="security-setup">
                <h3>Save your recovery codes</h3>
                <p>
                  Store these somewhere safe. Each code works once if you lose
                  your authenticator.
                </p>
                <ul className="security-recovery">
                  {recoveryCodes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="hub-btn hub-btn--primary"
                  onClick={() => {
                    setStep('idle');
                    setRecoveryCodes(null);
                    setSecret('');
                    setQrUrl('');
                  }}
                >
                  Done
                </button>
              </div>
            )}

            {step === 'disable' && (
              <div className="security-setup">
                <p>Confirm with your password and a current authenticator code.</p>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Authenticator code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    placeholder="123456"
                  />
                </label>
                <div className="security-card__actions">
                  <button
                    type="button"
                    className="hub-btn hub-btn--danger"
                    disabled={busy}
                    onClick={() => void disable2FA()}
                  >
                    {busy ? 'Turning off…' : 'Turn off 2FA'}
                  </button>
                  <button
                    type="button"
                    className="hub-btn hub-btn--soft"
                    disabled={busy}
                    onClick={() => setStep('idle')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
