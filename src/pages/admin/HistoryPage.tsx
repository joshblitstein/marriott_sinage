import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import {
  auditActorRolesVisibleTo,
  isAdmin,
} from '../../lib/roles';
import { HOTEL_TZ } from '../../lib/time';
import type { AuditLogEntry, AuditStatus, UserRole } from '../../types';

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: HOTEL_TZ,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** “Maya Reyes” → “M. Reyes”; falls back to username */
function formatWhoName(log: AuditLogEntry): string {
  const raw = (log.actorName || log.actorUsername || '').trim();
  if (!raw) return 'Unknown';
  if (log.actorRole === 'system') return raw;

  const parts = raw.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0][0]?.toUpperCase() ?? '';
    const last = parts[parts.length - 1];
    const lastLabel =
      last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
    return `${first}. ${lastLabel}`;
  }
  return raw;
}

function historyRoleLabel(role: AuditLogEntry['actorRole']): string | null {
  if (role === 'system') return null;
  if (role === 'user') return 'editor';
  if (role === 'manager') return 'manager';
  if (role === 'admin') return 'admin';
  return role;
}

function formatWho(log: AuditLogEntry): string {
  const name = formatWhoName(log);
  const role = historyRoleLabel(log.actorRole);
  return role ? `${name} (${role})` : name;
}

function statusLabel(status: AuditStatus | undefined): string {
  if (status === 'staged') return 'Staged';
  if (status === 'alert') return 'Alert';
  return 'Live';
}

function resolveStatus(log: AuditLogEntry): AuditStatus {
  if (log.status) return log.status;
  if (String(log.action).includes('offline')) return 'alert';
  if (
    log.action === 'event.create' ||
    log.action === 'event.update' ||
    log.action === 'event.delete'
  ) {
    return 'staged';
  }
  return 'live';
}

export function HistoryPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const visibleRoles = auditActorRolesVisibleTo(user);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(400)),
      (snap) => {
        setLogs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry),
        );
      },
      (err) => setError(err.message),
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (log.actorRole === 'system') return admin;
      if (visibleRoles.includes(log.actorRole as UserRole)) return true;
      if (admin && log.entityType === 'account') return true;
      if (admin && log.action === 'publish') return true;
      return false;
    });
  }, [logs, visibleRoles, admin]);

  return (
    <section className="history-page">
      <header className="history-page__header">
        <h1>History</h1>
        <p>
          Every change to events, layout and screens, with who made it and when
          it went live.
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Change</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="history-table__empty">
                  No activity yet for your team.
                </td>
              </tr>
            )}
            {filtered.map((log) => {
              const status = resolveStatus(log);
              return (
                <tr key={log.id}>
                  <td className="history-table__when">{formatWhen(log.at)}</td>
                  <td className="history-table__who">{formatWho(log)}</td>
                  <td className="history-table__change">{log.summary}</td>
                  <td className="history-table__status">
                    <span className={`history-pill history-pill--${status}`}>
                      {statusLabel(status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
