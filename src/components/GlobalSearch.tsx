import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { isAdmin, isLead, roleLabel } from '../lib/roles';
import { isScreenOnline } from '../lib/screenPresence';
import { formatTimeRange, HOTEL_TZ } from '../lib/time';
import type {
  AuditLogEntry,
  Organization,
  Room,
  SignageEvent,
  UserDocument,
} from '../types';

type RoomRow = Room & {
  lastSeenAt?: string;
  screenOnline?: boolean;
};

type UserRow = UserDocument & { id: string };

type SearchBundle = {
  rooms: RoomRow[];
  events: SignageEvent[];
  organizations: Organization[];
  users: UserRow[];
  auditLogs: AuditLogEntry[];
};

const EMPTY: SearchBundle = {
  rooms: [],
  events: [],
  organizations: [],
  users: [],
  auditLogs: [],
};

function hay(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function matches(q: string, ...parts: Array<string | null | undefined>): boolean {
  if (!q) return false;
  return hay(...parts).includes(q);
}

function formatEventWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: HOTEL_TZ,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatAuditWhen(iso: string): string {
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

async function loadSearchBundle(includeAccounts: boolean): Promise<SearchBundle> {
  const [roomsSnap, eventsSnap, orgsSnap, usersSnap, logsSnap] =
    await Promise.all([
      getDocs(query(collection(db, 'rooms'), orderBy('sortOrder'))),
      getDocs(
        query(collection(db, 'events'), orderBy('dateKey', 'desc'), limit(400)),
      ),
      getDocs(query(collection(db, 'organizations'), orderBy('displayName'))),
      includeAccounts
        ? getDocs(query(collection(db, 'users'), orderBy('username')))
        : Promise.resolve(null),
      includeAccounts
        ? getDocs(
            query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(200)),
          )
        : Promise.resolve(null),
    ]);

  return {
    rooms: roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomRow),
    events: eventsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SignageEvent,
    ),
    organizations: orgsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as Organization,
    ),
    users: usersSnap
      ? usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRow)
      : [],
    auditLogs: logsSnap
      ? logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry)
      : [],
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function GlobalSearch({ open, onClose }: Props) {
  const { user } = useAuth();
  const lead = isLead(user);
  const admin = isAdmin(user);
  const navigate = useNavigate();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queryText, setQueryText] = useState('');
  const deferred = useDeferredValue(queryText.trim().toLowerCase());
  const [bundle, setBundle] = useState<SearchBundle>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowMs = Date.now();

  function go(path: string) {
    onClose();
    navigate(path);
  }

  useEffect(() => {
    if (!open) return;
    setQueryText('');
    setError(null);
    setLoading(true);
    void loadSearchBundle(lead)
      .then((data) => setBundle(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Search failed'),
      )
      .finally(() => setLoading(false));
  }, [open, lead]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const roomById = useMemo(() => {
    const map = new Map<string, RoomRow>();
    for (const room of bundle.rooms) map.set(room.id, room);
    return map;
  }, [bundle.rooms]);

  const results = useMemo(() => {
    const q = deferred;
    if (!q) {
      return {
        events: [] as SignageEvent[],
        rooms: [] as RoomRow[],
        organizations: [] as Organization[],
        users: [] as UserRow[],
        auditLogs: [] as AuditLogEntry[],
      };
    }

    const events = bundle.events
      .filter((ev) =>
        matches(
          q,
          ev.orgNameRaw,
          ev.title,
          ev.functionType,
          ev.roomId,
          ev.dateKey,
          ev.source,
          roomById.get(ev.roomId)?.displayName,
          roomById.get(ev.roomId)?.name,
        ),
      )
      .slice(0, 40);

    const rooms = bundle.rooms
      .filter((room) =>
        matches(
          q,
          room.displayName,
          room.name,
          room.id,
          ...(room.bookingAliases ?? []),
        ),
      )
      .slice(0, 40);

    const organizations = bundle.organizations
      .filter((org) =>
        matches(
          q,
          org.displayName,
          org.name,
          org.id,
          ...(org.aliases ?? []),
        ),
      )
      .slice(0, 40);

    const users = bundle.users
      .filter((row) =>
        matches(q, row.username, row.name, row.role, row.email),
      )
      .slice(0, 40);

    const auditLogs = bundle.auditLogs
      .filter((log) =>
        matches(
          q,
          log.summary,
          log.actorUsername,
          log.actorName,
          log.actorRole,
          log.action,
          log.entityId,
          ...(log.detail ? Object.values(log.detail) : []),
        ),
      )
      .slice(0, 40);

    return { events, rooms, organizations, users, auditLogs };
  }, [deferred, bundle, roomById]);

  const total =
    results.events.length +
    results.rooms.length +
    results.organizations.length +
    results.users.length +
    results.auditLogs.length;

  if (!open) return null;

  return (
    <div className="gs-overlay" role="presentation" onClick={onClose}>
      <div
        className="gs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gs-modal__head">
          <h2 id={titleId}>Search</h2>
          <button
            type="button"
            className="gs-modal__close"
            onClick={onClose}
            aria-label="Close search"
          >
            Esc
          </button>
        </div>

        <label className="gs-modal__field">
          <span className="visually-hidden">Search all tables</span>
          <input
            ref={inputRef}
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search events, rooms, organizations, accounts…"
            autoComplete="off"
          />
        </label>

        <p className="gs-modal__hint">
          Compares your query against every table and shows matches in each
          table’s format.
        </p>

        {error && <p className="banner error">{error}</p>}

        <div className="gs-modal__body">
          {loading && <p className="gs-modal__empty">Loading tables…</p>}

          {!loading && !deferred && (
            <p className="gs-modal__empty">
              Type to search across events, rooms, organizations
              {lead ? ', accounts, and activity' : ''}.
            </p>
          )}

          {!loading && deferred && total === 0 && (
            <p className="gs-modal__empty">
              No matches for “{queryText.trim()}”.
            </p>
          )}

          {!loading && deferred && results.events.length > 0 && (
            <section className="gs-section">
              <h3>
                Events <span>{results.events.length}</span>
              </h3>
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Organization</th>
                    <th>Title</th>
                    <th>Room</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {results.events.map((ev) => (
                    <tr
                      key={ev.id}
                      className="is-clickable"
                      tabIndex={0}
                      role="link"
                      title="Open on schedule"
                      onClick={() =>
                        go(
                          `/admin?date=${encodeURIComponent(ev.dateKey)}&event=${encodeURIComponent(ev.id)}`,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          go(
                            `/admin?date=${encodeURIComponent(ev.dateKey)}&event=${encodeURIComponent(ev.id)}`,
                          );
                        }
                      }}
                    >
                      <td>{ev.dateKey || formatEventWhen(ev.startTime)}</td>
                      <td>
                        <strong>{ev.orgNameRaw || '—'}</strong>
                      </td>
                      <td>{ev.title || ev.functionType || '—'}</td>
                      <td>
                        {roomById.get(ev.roomId)?.displayName ?? ev.roomId}
                      </td>
                      <td className="gs-table__muted">
                        {formatTimeRange(ev.startTime, ev.endTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link className="gs-section__link" to="/admin" onClick={onClose}>
                Open schedule
              </Link>
            </section>
          )}

          {!loading && deferred && results.rooms.length > 0 && (
            <section className="gs-section">
              <h3>
                Rooms <span>{results.rooms.length}</span>
              </h3>
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Screen</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rooms.map((room) => {
                    const online = isScreenOnline(room, nowMs);
                    return (
                      <tr
                        key={room.id}
                        className="is-clickable"
                        tabIndex={0}
                        role="link"
                        title="Open room display"
                        onClick={() => {
                          onClose();
                          window.open(`/display/${room.id}`, '_blank', 'noopener,noreferrer');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onClose();
                            window.open(`/display/${room.id}`, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <td>
                          <strong>{room.displayName}</strong>
                        </td>
                        <td className="gs-table__muted">{room.id}</td>
                        <td>{room.active ? 'Active' : 'Inactive'}</td>
                        <td>
                          <span
                            className={`status-dot ${online ? 'online' : 'offline'}`}
                          />
                          {online ? 'Online' : 'Offline'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="gs-section__links">
                {admin && (
                  <>
                    <Link
                      className="gs-section__link"
                      to="/admin/rooms"
                      onClick={onClose}
                    >
                      Open rooms
                    </Link>
                    <Link
                      className="gs-section__link"
                      to="/admin/floor-plan"
                      onClick={onClose}
                    >
                      Floor plan
                    </Link>
                  </>
                )}
                <Link
                  className="gs-section__link"
                  to="/admin"
                  onClick={onClose}
                >
                  Open schedule
                </Link>
              </div>
            </section>
          )}

          {!loading && deferred && results.organizations.length > 0 && (
            <section className="gs-section">
              <h3>
                Organizations <span>{results.organizations.length}</span>
              </h3>
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Display name</th>
                    <th>Logo</th>
                  </tr>
                </thead>
                <tbody>
                  {results.organizations.map((org) => (
                    <tr
                      key={org.id}
                      className="is-clickable"
                      tabIndex={0}
                      role="link"
                      title="Open organization"
                      onClick={() =>
                        go(
                          `/admin/organizations?q=${encodeURIComponent(org.displayName || org.name)}`,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          go(
                            `/admin/organizations?q=${encodeURIComponent(org.displayName || org.name)}`,
                          );
                        }
                      }}
                    >
                      <td>
                        <strong>{org.name}</strong>
                      </td>
                      <td>{org.displayName}</td>
                      <td>{org.logoUrl ? 'Yes' : 'Missing'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link
                className="gs-section__link"
                to="/admin/organizations"
                onClick={onClose}
              >
                Open organizations
              </Link>
            </section>
          )}

          {!loading && deferred && lead && results.users.length > 0 && (
            <section className="gs-section">
              <h3>
                Accounts <span>{results.users.length}</span>
              </h3>
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.users.map((row) => (
                    <tr
                      key={row.id}
                      className="is-clickable"
                      tabIndex={0}
                      role="link"
                      title="Open accounts"
                      onClick={() => go('/admin/accounts')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          go('/admin/accounts');
                        }
                      }}
                    >
                      <td>
                        <strong>{row.username}</strong>
                        {row.name && (
                          <div className="gs-table__muted">{row.name}</div>
                        )}
                      </td>
                      <td>{roleLabel(row.role)}</td>
                      <td>
                        {row.active !== false ? 'Active' : 'Deactivated'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link
                className="gs-section__link"
                to="/admin/accounts"
                onClick={onClose}
              >
                Open accounts
              </Link>
            </section>
          )}

          {!loading && deferred && lead && results.auditLogs.length > 0 && (
            <section className="gs-section">
              <h3>
                Activity <span>{results.auditLogs.length}</span>
              </h3>
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Change</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="is-clickable"
                      tabIndex={0}
                      role="link"
                      title="Open history"
                      onClick={() => go('/admin/history')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          go('/admin/history');
                        }
                      }}
                    >
                      <td className="gs-table__muted">
                        {formatAuditWhen(log.at)}
                      </td>
                      <td>
                        <strong>{log.actorUsername}</strong>
                      </td>
                      <td>{log.summary}</td>
                      <td>
                        <span
                          className={`history-pill history-pill--${log.status || 'live'}`}
                        >
                          {log.status === 'staged'
                            ? 'Staged'
                            : log.status === 'alert'
                              ? 'Alert'
                              : 'Live'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link
                className="gs-section__link"
                to="/admin/history"
                onClick={onClose}
              >
                Open history
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
