import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { hashPassword, userIdFromUsername } from './password';
import type { AppUser, UserSession } from '../types';

const SESSION_KEY = 'marriott_signage_session';

export function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession & {
      user: AppUser & { email?: string };
    };
    // Migrate older sessions that stored `email`
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

/**
 * Sign in against the Firestore `users` collection (not Firebase Auth).
 * Document id = normalized username; password compared as SHA-256 hash.
 */
export async function signInWithUsersTable(
  username: string,
  password: string,
): Promise<AppUser> {
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

  const user: AppUser = {
    id,
    username: resolvedUsername,
    name: data.name ? String(data.name) : undefined,
    role: (data.role as AppUser['role']) ?? 'admin',
  };

  saveSession({
    user,
    loggedInAt: new Date().toISOString(),
  });

  return user;
}
