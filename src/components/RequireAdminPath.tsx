import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessAdminPath } from '../lib/roles';

/** Blocks managers from admin-only routes (import, rooms, screens, etc.) */
export function RequireAdminPath() {
  const { user } = useAuth();
  const location = useLocation();

  if (!canAccessAdminPath(user, location.pathname)) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
