import type { AppUser, UserRole } from '../types';

export type { UserRole };

/** Operational routes shared by managers and users */
export const STAFF_PATHS = new Set([
  '/admin',
  '/admin/organizations',
]);

/** Account + history routes for admin and manager */
export const LEAD_PATHS = new Set([
  '/admin/accounts',
  '/admin/history',
]);

export function parseRole(value: unknown): UserRole {
  if (value === 'manager' || value === 'user' || value === 'admin') {
    return value;
  }
  // Legacy docs without a role were admins
  return 'admin';
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'user':
      return 'User';
  }
}

export function isAdmin(user: AppUser | null | undefined): boolean {
  return user?.role === 'admin';
}

export function isManager(user: AppUser | null | undefined): boolean {
  return user?.role === 'manager';
}

export function isUser(user: AppUser | null | undefined): boolean {
  return user?.role === 'user';
}

/** Admin or manager — can open Accounts + History */
export function isLead(user: AppUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'manager';
}

/** Roles the actor is allowed to assign when creating/editing accounts */
export function creatableRoles(actor: AppUser | null | undefined): UserRole[] {
  if (!actor) return [];
  if (actor.role === 'admin') return ['manager', 'user'];
  if (actor.role === 'manager') return ['user'];
  return [];
}

export function canCreateRole(
  actor: AppUser | null | undefined,
  target: UserRole,
): boolean {
  return creatableRoles(actor).includes(target);
}

/** Can this actor change the target account's role / active / password? */
export function canManageAccount(
  actor: AppUser | null | undefined,
  target: Pick<AppUser, 'id' | 'role'> & { active?: boolean },
): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') {
    // Admins manage managers and users (not other admins via UI)
    return target.role === 'manager' || target.role === 'user';
  }
  if (actor.role === 'manager') {
    return target.role === 'user';
  }
  return false;
}

export function canAccessAdminPath(
  user: AppUser | null | undefined,
  pathname: string,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'manager') {
    if (STAFF_PATHS.has(pathname) || LEAD_PATHS.has(pathname)) return true;
    return (
      pathname === '/admin' ||
      pathname.startsWith('/admin/organizations') ||
      pathname.startsWith('/admin/accounts') ||
      pathname.startsWith('/admin/history')
    );
  }

  if (user.role === 'user') {
    if (STAFF_PATHS.has(pathname)) return true;
    return (
      pathname === '/admin' || pathname.startsWith('/admin/organizations')
    );
  }

  return false;
}

/** History visibility: whose actions this viewer may see */
export function auditActorRolesVisibleTo(
  viewer: AppUser | null | undefined,
): UserRole[] {
  if (!viewer) return [];
  if (viewer.role === 'admin') return ['manager', 'user'];
  if (viewer.role === 'manager') return ['user'];
  return [];
}
