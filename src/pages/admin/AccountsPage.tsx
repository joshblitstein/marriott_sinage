import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { db } from '../../lib/firebase';
import { hashPassword, userIdFromUsername } from '../../lib/password';
import {
  canCreateRole,
  canManageAccount,
  creatableRoles,
  isAdmin,
  roleLabel,
} from '../../lib/roles';
import type { UserDocument, UserRole } from '../../types';

type UserRow = UserDocument & { id: string };
type StatusFilter = 'all' | 'active' | 'deactivated';

const MIN_PASSWORD = 8;

export function AccountsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const allowedRoles = creatableRoles(user);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(allowedRoles[0] ?? 'user');

  useEffect(() => {
    if (allowedRoles.length && !allowedRoles.includes(role)) {
      setRole(allowedRoles[0]);
    }
  }, [allowedRoles, role]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'users'), orderBy('username')),
      (snap) => {
        setRows(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRow),
        );
      },
      (err) => setError(err.message),
    );
    return unsub;
  }, []);

  const visible = useMemo(() => {
    if (!user) return [];
    return rows.filter((row) => {
      if (row.id === user.id) return true;
      return canManageAccount(user, { id: row.id, role: row.role });
    });
  }, [rows, user]);

  const filtered = useMemo(() => {
    return visible.filter((row) => {
      const active = row.active !== false;
      if (statusFilter === 'active') return active;
      if (statusFilter === 'deactivated') return !active;
      return true;
    });
  }, [visible, statusFilter]);

  const activeCount = useMemo(
    () => visible.filter((r) => r.active !== false).length,
    [visible],
  );

  function flashOk(message: string) {
    setOk(message);
    setError(null);
    window.setTimeout(() => setOk(null), 4000);
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = username.trim().toLowerCase();
      if (!trimmed || trimmed.length < 2) {
        throw new Error('Username must be at least 2 characters.');
      }
      if (password.length < MIN_PASSWORD) {
        throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
      }
      if (!canCreateRole(user, role)) {
        throw new Error('You cannot create that role.');
      }

      const id = userIdFromUsername(trimmed);
      if (rows.some((r) => r.id === id)) {
        throw new Error('That username already exists.');
      }

      const now = new Date().toISOString();
      const passwordHash = await hashPassword(password);
      const docBody: UserDocument = {
        username: trimmed,
        email: trimmed,
        passwordHash,
        name: name.trim() || undefined,
        role,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', id), docBody);
      await writeAuditLog(db, {
        actor: user,
        action: 'account.create',
        entityType: 'account',
        entityId: id,
        status: 'live',
        summary: `Created ${roleLabel(role).toLowerCase()} account “${trimmed}”`,
        detail: {
          targetUsername: trimmed,
          targetRole: role,
          targetName: name.trim() || null,
        },
      });

      setUsername('');
      setName('');
      setPassword('');
      setRole(allowedRoles[0] ?? 'user');
      flashOk(`Created ${trimmed} (${roleLabel(role)})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  }

  async function setAccountRole(row: UserRow, nextRole: UserRole) {
    if (!user || row.role === nextRole) return;
    if (!canManageAccount(user, row) || !canCreateRole(user, nextRole)) {
      setError('You cannot assign that role.');
      return;
    }
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', row.id), {
      role: nextRole,
      updatedAt: now,
    });
    await writeAuditLog(db, {
      actor: user,
      action: 'account.role_change',
      entityType: 'account',
      entityId: row.id,
      status: 'live',
      summary: `Changed ${row.username} from ${roleLabel(row.role)} to ${roleLabel(nextRole)}`,
      detail: {
        targetUsername: row.username,
        fromRole: row.role,
        toRole: nextRole,
      },
    });
    flashOk(`Updated role for ${row.username}`);
  }

  async function setAccountActive(row: UserRow, active: boolean) {
    if (!user || !canManageAccount(user, row)) return;
    if (row.id === user.id) {
      setError('You cannot deactivate your own account.');
      return;
    }
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', row.id), { active, updatedAt: now });
    await writeAuditLog(db, {
      actor: user,
      action: active ? 'account.activate' : 'account.deactivate',
      entityType: 'account',
      entityId: row.id,
      status: 'live',
      summary: `${active ? 'Activated' : 'Deactivated'} account “${row.username}”`,
      detail: {
        targetUsername: row.username,
        targetRole: row.role,
      },
    });
    flashOk(`${active ? 'Activated' : 'Deactivated'} ${row.username}`);
  }

  async function resetPassword(row: UserRow) {
    if (!user || !canManageAccount(user, row)) return;
    const next = window.prompt(
      `New password for ${row.username} (min ${MIN_PASSWORD} characters):`,
    );
    if (next == null) return;
    if (next.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(next);
    await updateDoc(doc(db, 'users', row.id), { passwordHash, updatedAt: now });
    await writeAuditLog(db, {
      actor: user,
      action: 'account.password_reset',
      entityType: 'account',
      entityId: row.id,
      status: 'live',
      summary: `Reset password for “${row.username}”`,
      detail: {
        targetUsername: row.username,
        targetRole: row.role,
      },
    });
    flashOk(`Password updated for ${row.username}`);
  }

  return (
    <section className="accounts-page">
      <header className="accounts-page__header">
        <h1>Accounts</h1>
        <p>
          {admin
            ? 'Create manager and user accounts, set roles, and deactivate access.'
            : 'Create user accounts and set roles for your team.'}
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}
      {ok && <p className="banner success">{ok}</p>}

      <div className="accounts-layout">
        <div className="accounts-team">
          <div className="accounts-team__head">
            <div>
              <h2>Team</h2>
              <p className="accounts-team__count">
                {activeCount} active of {visible.length}
              </p>
            </div>
            <div className="accounts-filter" role="group" aria-label="Status filter">
              {(
                [
                  ['all', 'All'],
                  ['active', 'Active'],
                  ['deactivated', 'Deactivated'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    statusFilter === id
                      ? 'accounts-filter__btn is-active'
                      : 'accounts-filter__btn'
                  }
                  onClick={() => setStatusFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="accounts-table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="accounts-table__empty">
                      No accounts in this view.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => {
                  const manageable = canManageAccount(user, row);
                  const isSelf = row.id === user?.id;
                  const active = row.active !== false;
                  const isOwner = isSelf && row.role === 'admin';

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="accounts-table__account">
                          <strong>
                            {row.username}
                            {isSelf ? ' (You)' : ''}
                          </strong>
                          {row.name && (
                            <span className="accounts-table__name">{row.name}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {manageable && !isSelf ? (
                          <select
                            className="accounts-table__role"
                            value={row.role}
                            onChange={(e) =>
                              void setAccountRole(
                                row,
                                e.target.value as UserRole,
                              )
                            }
                          >
                            {allowedRoles.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r)}
                              </option>
                            ))}
                            {!allowedRoles.includes(row.role) && (
                              <option value={row.role}>
                                {roleLabel(row.role)}
                              </option>
                            )}
                          </select>
                        ) : (
                          <span className="accounts-table__role-text">
                            {roleLabel(row.role)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            active
                              ? 'accounts-status accounts-status--active'
                              : 'accounts-status accounts-status--off'
                          }
                        >
                          {active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        {isOwner || (isSelf && !manageable) ? (
                          <span className="accounts-table__owner">
                            Owner account
                          </span>
                        ) : manageable ? (
                          <div className="accounts-actions">
                            <button
                              type="button"
                              className="accounts-actions__link"
                              onClick={() => void resetPassword(row)}
                            >
                              Reset password
                            </button>
                            <button
                              type="button"
                              className={
                                active
                                  ? 'accounts-actions__link accounts-actions__link--danger'
                                  : 'accounts-actions__link'
                              }
                              onClick={() =>
                                void setAccountActive(row, !active)
                              }
                            >
                              {active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : (
                          <span className="accounts-table__owner">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <form
          className="accounts-new"
          onSubmit={(e) => void createAccount(e)}
        >
          <h2>New account</h2>
          <p className="accounts-new__lede">
            {admin
              ? 'Managers can edit content and publish. Users can view and stage changes.'
              : 'Users can update events and organization logos on the schedule.'}
          </p>

          <label className="accounts-new__field">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label className="accounts-new__field">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="accounts-new__field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              placeholder={`At least ${MIN_PASSWORD} characters`}
            />
          </label>

          <div className="accounts-new__field">
            <span className="accounts-new__label">Role</span>
            <div className="accounts-role-toggle" role="group" aria-label="Role">
              {allowedRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={
                    role === r
                      ? 'accounts-role-toggle__btn is-active'
                      : 'accounts-role-toggle__btn'
                  }
                  onClick={() => setRole(r)}
                >
                  {roleLabel(r)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="accounts-new__submit"
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  );
}
