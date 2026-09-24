import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { hashPassword, userIdFromUsername } from './password';
import {
  consumeRecoveryCode,
  verifyTotpCode,
} from './totp';
import type { AppUser, UserRole, UserSession } from '../types';

const SESSION_KEY = 'marriott_signage_session';
const PENDING_2FA_KEY = 'marriott_signage_pending_2fa';

type Pending2FA = {
  userId: string;
  username: string;
  name?: string;
  role: UserRole;
  totpSecret: string;
  recoveryHashes: string[];
  createdAt: string;
};

export type SignInResult =
  | { status: 'ok'; user: AppUser }
  | { status: 'totp_required'; username: string };

export function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession & {
      user: AppUser & { email?: string };
    };
    if (session.user && !session.user.username && session.user.email) {
      session.user.username = session.user.email;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function savePending2FA(pending: Pending2FA): void {
  sessionStorage.setItem(PENDING_2FA_KEY, JSON.stringify(pending));
}

export function loadPending2FA(): Pending2FA | null {
  try {
    const raw = sessionStorage.getItem(PENDING_2FA_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Pending2FA;
    const age = Date.now() - new Date(pending.createdAt).getTime();
    if (age > 10 * 60 * 1000) {
      clearPending2FA();
      return null;
    }
    return pending;
  } catch {
    return null;
  }
}

export function clearPending2FA(): void {
  sessionStorage.removeItem(PENDING_2FA_KEY);
}

function toAppUser(pending: Pick<Pending2FA, 'userId' | 'username' | 'name' | 'role'>): AppUser {
  return {
    id: pending.userId,
    username: pending.username,
    name: pending.name,
    role: pending.role,
  };
}

function finishSession(user: AppUser): AppUser {
  saveSession({
    user,
    loggedInAt: new Date().toISOString(),
  });
  clearPending2FA();
  return user;
}

/**
 * Sign in against the Firestore `users` collection (not Firebase Auth).
 * If 2FA is enabled, returns totp_required and does not create a session yet.
 */
export async function signInWithUsersTable(
  username: string,
  password: string,
): Promise<SignInResult> {
  const id = userIdFromUsername(username);
  const snap = await getDoc(doc(db, 'users', id));

  if (!snap.exists()) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const data = snap.data();
  const passwordHash = await hashPassword(password);

  if (data.passwordHash !== passwordHash) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (data.active === false) {
    throw new Error('INACTIVE');
  }

  const resolvedUsername = String(data.username ?? data.email ?? username)
    .trim()
    .toLowerCase();

  const role: UserRole =
    data.role === 'manager'
      ? 'manager'
      : data.role === 'user'
        ? 'user'
        : 'admin';

  const user: AppUser = {
    id,
    username: resolvedUsername,
    name: data.name ? String(data.name) : undefined,
    role,
  };

  const totpEnabled = Boolean(data.totpEnabled && data.totpSecret);
  if (totpEnabled) {
    savePending2FA({
      userId: id,
      username: resolvedUsername,
      name: user.name,
      role,
      totpSecret: String(data.totpSecret),
      recoveryHashes: Array.isArray(data.totpRecoveryHashes)
        ? data.totpRecoveryHashes.map(String)
        : [],
      createdAt: new Date().toISOString(),
    });
    return { status: 'totp_required', username: resolvedUsername };
  }

  return { status: 'ok', user: finishSession(user) };
}

/**
 * Complete sign-in with authenticator code or recovery code after password step.
 */
export async function completeTotpSignIn(code: string): Promise<AppUser> {
  const pending = loadPending2FA();
  if (!pending) {
    throw new Error('TOTP_EXPIRED');
  }

  const cleaned = code.trim();
  const isTotp = /^\d{6}$/.test(cleaned.replace(/\s+/g, ''));

  if (isTotp) {
    if (!verifyTotpCode(pending.totpSecret, cleaned)) {
      throw new Error('INVALID_TOTP');
    }
    return finishSession(toAppUser(pending));
  }

  const remaining = await consumeRecoveryCode(
    cleaned,
    pending.recoveryHashes,
  );
  if (!remaining) {
    throw new Error('INVALID_TOTP');
  }

  await updateDoc(doc(db, 'users', pending.userId), {
    totpRecoveryHashes: remaining,
    updatedAt: new Date().toISOString(),
  });

  return finishSession(toAppUser(pending));
}
