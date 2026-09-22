import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Protects /admin/* routes — requires a session from the Firestore users table */
export function RequireAuth() {
  const { user, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-shell">
        <p>Loading…</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="app-shell">
        <h1>Firebase not configured</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code> and add your
          Firebase web app credentials.
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
