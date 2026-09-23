import type { AppUser } from '../types';

export type UserRole = AppUser['role'];

/** Routes managers may open in the admin hub */
export const MANAGER_PATHS = new Set(['/admin', '/admin/organizations']);

export function isAdmin(user: AppUser | null | undefined): boolean {
  return user?.role === 'admin';
}

export function isManager(user: AppUser | null | undefined): boolean {
  return user?.role === 'manager';
}

export function canAccessAdminPath(
  user: AppUser | null | undefined,
  pathname: string,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'manager') {
    if (MANAGER_PATHS.has(pathname)) return true;
    // Allow nested schedule paths if any are added later
    return pathname === '/admin' || pathname.startsWith('/admin/organizations');
  }
  return false;
}
