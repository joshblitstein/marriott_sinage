import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  clearPending2FA,
  clearSession,
  completeTotpSignIn,
  loadPending2FA,
  loadSession,
  signInWithUsersTable,
} from '../lib/session';
import type { AppUser } from '../types';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  configured: boolean;
  /** Password accepted; waiting for authenticator / recovery code */
  totpPendingUsername: string | null;
  signIn: (username: string, password: string) => Promise<'ok' | 'totp_required'>;
  verifyTotp: (code: string) => Promise<void>;
  cancelTotp: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [totpPendingUsername, setTotpPendingUsername] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const session = loadSession();
    setUser(session?.user ?? null);
    const pending = loadPending2FA();
    setTotpPendingUsername(pending?.username ?? null);
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      totpPendingUsername,
      async signIn(username, password) {
        const result = await signInWithUsersTable(username, password);
        if (result.status === 'totp_required') {
          setTotpPendingUsername(result.username);
          return 'totp_required';
        }
        setTotpPendingUsername(null);
        setUser(result.user);
        return 'ok';
      },
      async verifyTotp(code) {
        const nextUser = await completeTotpSignIn(code);
        setTotpPendingUsername(null);
        setUser(nextUser);
      },
      cancelTotp() {
        clearPending2FA();
        setTotpPendingUsername(null);
      },
      async signOut() {
        clearPending2FA();
        clearSession();
        setTotpPendingUsername(null);
        setUser(null);
      },
    }),
    [user, loading, totpPendingUsername],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
