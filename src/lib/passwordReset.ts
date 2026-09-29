import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { hashPassword, userIdFromUsername } from './password';
import { consumeRecoveryCode, verifyTotpCode } from './totp';

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordResetLookup =
  | { status: 'not_found' }
  | { status: 'inactive' }
  | { status: 'totp_available'; username: string }
  | { status: 'admin_required'; username: string };

/**
 * Look up an account for forgot-password.
 * Does not reveal whether the username exists to the caller beyond the typed result —
 * UI should show a generic message for not_found / inactive / admin_required.
 */
export async function lookupPasswordReset(
  username: string,
): Promise<PasswordResetLookup> {
  const id = userIdFromUsername(username);
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return { status: 'not_found' };

  const data = snap.data();
  if (data.active === false) return { status: 'inactive' };

  const resolved = String(data.username ?? data.email ?? username)
    .trim()
    .toLowerCase();

  if (data.totpEnabled && data.totpSecret) {
    return { status: 'totp_available', username: resolved };
  }

  return { status: 'admin_required', username: resolved };
}

/** Flag the account so a lead/admin can finish the reset in Accounts. */
export async function requestAdminPasswordReset(
  username: string,
): Promise<void> {
  const id = userIdFromUsername(username);
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return;
  if (snap.data().active === false) return;

  const now = new Date().toISOString();
  await updateDoc(doc(db, 'users', id), {
    passwordResetRequestedAt: now,
    updatedAt: now,
  });
}

/**
 * Self-serve reset: prove identity with authenticator or recovery code, then set a new password.
 */
export async function resetPasswordWithSecondFactor(input: {
  username: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error('WEAK_PASSWORD');
  }

  const id = userIdFromUsername(input.username);
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) throw new Error('INVALID');
  const data = snap.data();
  if (data.active === false) throw new Error('INACTIVE');
  if (!data.totpEnabled || !data.totpSecret) throw new Error('NO_TOTP');

  const cleaned = input.code.trim();
  const isTotp = /^\d{6}$/.test(cleaned.replace(/\s+/g, ''));
  let recoveryHashes = Array.isArray(data.totpRecoveryHashes)
    ? data.totpRecoveryHashes.map(String)
    : [];

  if (isTotp) {
    if (!verifyTotpCode(String(data.totpSecret), cleaned)) {
      throw new Error('INVALID_CODE');
    }
  } else {
    const remaining = await consumeRecoveryCode(cleaned, recoveryHashes);
    if (!remaining) throw new Error('INVALID_CODE');
    recoveryHashes = remaining;
  }

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'users', id), {
    passwordHash,
    totpRecoveryHashes: recoveryHashes,
    passwordResetRequestedAt: null,
    updatedAt: now,
  });
}
