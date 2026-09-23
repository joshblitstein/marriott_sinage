import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { groupRoomsBySection } from '../../lib/roomSections';
import { isAdmin } from '../../lib/roles';
import { writeAuditLog } from '../../lib/audit';
import {
  eventsForRoomDisplay,
  pickCurrentAndNext,
  rebuildRoomDisplaysForDate,
} from '../../lib/schedule';
import {
  dateKeyInHotelTz,
  formatTimeRange,
  HOTEL_TZ,
} from '../../lib/time';
import { isScreenOnline } from '../../lib/screenPresence';
import type { DisplayEventSnapshot, Room, SignageEvent } from '../../types';

type RoomWithSeen = Room & {
  lastSeenAt?: string;
  screenOnline?: boolean;
  scheduleDateKey?: string;
  scheduleEvents?: DisplayEventSnapshot[];
};
type ScreenStatus = 'online' | 'offline';

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, '0')}`,
  };
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function screenStatus(
  room: Pick<RoomWithSeen, 'lastSeenAt' | 'screenOnline'>,
  nowMs: number,
): ScreenStatus {
  return isScreenOnline(room, nowMs) ? 'online' : 'offline';
}

/** Prefer the same embedded schedule the room tablets use when dates match. */
function snapshotsForRoom(
  room: RoomWithSeen,
  dateKey: string,
  dayEvents: SignageEvent[],
): DisplayEventSnapshot[] {
  if (room.scheduleDateKey === dateKey && Array.isArray(room.scheduleEvents)) {
    return room.scheduleEvents;
  }
  return eventsForRoomDisplay(dayEvents, room.id).map((e) => ({
    id: e.id,
    orgId: e.orgId,
    orgName: e.orgNameRaw,
    orgDisplayName: e.orgNameRaw,
    logoUrl: null,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    functionType: e.functionType,
    source: e.source,
    display: e.display,
  }));
}

export function AdminDashboard() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const todayKey = dateKeyInHotelTz();
  const [dateKey, setDateKey] = useState(todayKey);
  const [rooms, setRooms] = useState<RoomWithSeen[]>([]);
  const [events, setEvents] = useState<SignageEvent[]>([]);
  const [monthEvents, setMonthEvents] = useState<SignageEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SignageEvent | null>(null);
  const [view, setView] = useState<'day' | 'month'>('day');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const searchQuery = useDeferredValue(search.trim().toLowerCase());

  const yearMonth = dateKey.slice(0, 7);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'rooms'), orderBy('sortOrder')),
      (snap) => {
        setRooms(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomWithSeen),
        );
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (view !== 'day') return;
    const unsub = onSnapshot(
      query(collection(db, 'events'), where('dateKey', '==', dateKey)),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as SignageEvent,
        );
        list.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        setEvents(list);
      },
    );
    return unsub;
  }, [dateKey, view]);

  useEffect(() => {
    if (view !== 'month') return;
    const { start, end } = monthBounds(yearMonth);
    const unsub = onSnapshot(
      query(
        collection(db, 'events'),
        where('dateKey', '>=', start),
        where('dateKey', '<=', end),
      ),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as SignageEvent,
        );
        setMonthEvents(list);
      },
    );
    return unsub;
  }, [view, yearMonth]);

  function selectDate(next: string) {
    setDateKey(next);
  }

  function openDay(next: string) {
    setDateKey(next);
    setView('day');
  }

  function shiftView(delta: number) {
    if (view === 'month') {
      const nextYm = shiftMonth(yearMonth, delta);
      setDateKey(`${nextYm}-01`);
    } else {
      selectDate(shiftDateKey(dateKey, delta));
    }
  }

  const activeRooms = useMemo(
    () => rooms.filter((r) => r.active),
    [rooms],
  );

  const roomById = useMemo(() => {
    const map = new Map<string, RoomWithSeen>();
    for (const room of rooms) map.set(room.id, room);
    return map;
  }, [rooms]);

  function matchesSearch(
    haystacks: Array<string | null | undefined>,
    q: string,
  ): boolean {
    if (!q) return true;
    return haystacks.some((h) => h?.toLowerCase().includes(q));
  }

  const filteredDayRooms = useMemo(() => {
    if (!searchQuery) return activeRooms;
    return activeRooms.filter((room) => {
      if (
        matchesSearch(
          [room.displayName, room.name, room.id, ...(room.bookingAliases ?? [])],
          searchQuery,
        )
      ) {
        return true;
      }
      const snaps = snapshotsForRoom(room, dateKey, events);
      return snaps.some((s) =>
        matchesSearch(
          [s.orgDisplayName, s.orgName, s.title, s.functionType],
          searchQuery,
        ),
      );
    });
  }, [activeRooms, searchQuery, dateKey, events]);

  const sections = useMemo(
    () => groupRoomsBySection(filteredDayRooms),
    [filteredDayRooms],
  );

  const summary = useMemo(() => {
    let eventCount = 0;
    let roomsInUse = 0;
    for (const room of filteredDayRooms) {
      const snaps = snapshotsForRoom(room, dateKey, events);
      if (snaps.length > 0) {
        roomsInUse += 1;
        eventCount += snaps.length;
      }
    }
    return {
      eventCount,
      roomsInUse,
      roomTotal: searchQuery ? filteredDayRooms.length : activeRooms.length,
    };
  }, [filteredDayRooms, activeRooms, dateKey, events, searchQuery]);

  const filteredMonthEvents = useMemo(() => {
    const visible = monthEvents.filter((e) => e.display !== false);
    if (!searchQuery) return visible;
    return visible.filter((ev) => {
      const room = roomById.get(ev.roomId);
      return matchesSearch(
        [
          ev.orgNameRaw,
          ev.title,
          ev.functionType,
          room?.displayName,
          room?.name,
          room?.id,
        ],
        searchQuery,
      );
    });
  }, [monthEvents, searchQuery, roomById]);

  const monthSummary = useMemo(() => {
    const byDay = new Map<string, SignageEvent[]>();
    for (const ev of filteredMonthEvents) {
      const list = byDay.get(ev.dateKey) ?? [];
      list.push(ev);
      byDay.set(ev.dateKey, list);
    }
    return {
      eventCount: filteredMonthEvents.length,
      daysWithEvents: byDay.size,
      byDay,
    };
  }, [filteredMonthEvents]);

  async function handleSaveEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const roomId = String(fd.get('roomId'));
    const title = String(fd.get('title'));
    const orgName = String(fd.get('orgName'));
    const startLocal = String(fd.get('start'));
    const endLocal = String(fd.get('end'));
    const startTime = new Date(startLocal).toISOString();
    const endTime = new Date(endLocal).toISOString();
    const now = new Date().toISOString();
    const id = editing?.id ?? `manual_${roomId}_${Date.now()}`;
    const isCreate = !editing;

    await setDoc(
      doc(db, 'events', id),
      {
        id,
        roomId,
        orgId: editing?.orgId ?? null,
        orgNameRaw: orgName,
        title,
        startTime,
        endTime,
        functionType: editing?.functionType ?? 'Manual',
        source: editing?.source === 'city' || editing?.source === 'delphi'
          ? editing.source
          : 'manual',
        display: true,
        dateKey,
        updatedAt: now,
        ...(editing?.orderNumber ? { orderNumber: editing.orderNumber } : {}),
      } satisfies SignageEvent,
      { merge: true },
    );
    await rebuildRoomDisplaysForDate(db, dateKey);
    // Keep live tablets on hotel-today even if a past/future day was edited
    const today = dateKeyInHotelTz();
    if (dateKey !== today) {
      await rebuildRoomDisplaysForDate(db, today);
    }

    if (user) {
      const roomName =
        roomById.get(roomId)?.displayName ?? roomId;
      const range = formatTimeRange(startTime, endTime);
      const label = [orgName, title].filter(Boolean).join(' · ');
      await writeAuditLog(db, {
        actor: user,
        action: isCreate ? 'event.create' : 'event.update',
        entityType: 'event',
        entityId: id,
        status: 'staged',
        summary: isCreate
          ? `Added manual event: ${label}, ${roomName} ${range}`
          : `Edited ${label}: updated ${roomName}`,
        detail: {
          roomId,
          roomName,
          orgName,
          title,
          dateKey,
        },
      });
    }

    setShowForm(false);
    setEditing(null);
    e.currentTarget.reset();
  }

  async function removeEvent(ev: SignageEvent) {
    if (ev.source !== 'manual') {
      alert(
        'Only manual events can be deleted here. Re-import to change CITY rows.',
      );
      return;
    }
    await deleteDoc(doc(db, 'events', ev.id));
    await rebuildRoomDisplaysForDate(db, dateKey);
    const today = dateKeyInHotelTz();
    if (dateKey !== today) {
      await rebuildRoomDisplaysForDate(db, today);
    }

    if (user) {
      const roomName =
        roomById.get(ev.roomId)?.displayName ?? ev.roomId;
      const label = [ev.orgNameRaw, ev.title].filter(Boolean).join(' · ');
      await writeAuditLog(db, {
        actor: user,
        action: 'event.delete',
        entityType: 'event',
        entityId: ev.id,
        status: 'staged',
        summary: `Removed manual event: ${label}, ${roomName}`,
        detail: {
          roomId: ev.roomId,
          roomName,
          orgName: ev.orgNameRaw,
          title: ev.title,
          dateKey: ev.dateKey,
        },
      });
    }

    setEditing(null);
    setShowForm(false);
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(ev: SignageEvent | DisplayEventSnapshot) {
    const full =
      events.find((e) => e.id === ev.id) ??
      ({
        id: ev.id,
        roomId:
          'roomId' in ev && typeof (ev as SignageEvent).roomId === 'string'
            ? (ev as SignageEvent).roomId
            : '',
        orgId: ev.orgId,
        orgNameRaw:
          'orgNameRaw' in ev
            ? (ev as SignageEvent).orgNameRaw
            : ev.orgDisplayName,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        functionType: ev.functionType,
        source: ev.source,
        display: ev.display,
        dateKey,
        updatedAt: new Date().toISOString(),
      } satisfies SignageEvent);
    if (!full.roomId) {
      const owner = activeRooms.find((r) =>
        (r.scheduleEvents ?? []).some((s) => s.id === ev.id),
      );
      full.roomId = owner?.id ?? activeRooms[0]?.id ?? '';
    }
    setEditing(full);
    setShowForm(true);
  }

  function toLocalInputValue(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const now = useMemo(() => new Date(nowMs), [nowMs]);

  return (
    <section className="hub-schedule">
      <header className="hub-schedule__header">
        <div>
          <h1>Today’s schedule</h1>
          <p className="hub-schedule__lede">
            Hotel time {HOTEL_TZ}. Displays auto-refresh to today at midnight;
            import a CITY file when the booking sheet changes. Manual events are
            flagged where they overlap a booking.
          </p>
        </div>
        <div className="hub-schedule__cta">
          {admin && (
            <Link className="hub-link" to="/admin/import">
              Import CITY file
            </Link>
          )}
          <button
            type="button"
            className="hub-btn hub-btn--primary"
            onClick={openCreate}
          >
            Add manual event
          </button>
        </div>
      </header>

      <div className="hub-filterbar">
        <div className="hub-segment" role="group" aria-label="View">
          <button
            type="button"
            className={view === 'day' ? 'is-active' : undefined}
            onClick={() => setView('day')}
          >
            Day
          </button>
          <button
            type="button"
            className={view === 'month' ? 'is-active' : undefined}
            onClick={() => setView('month')}
          >
            Month
          </button>
        </div>

        <div className="hub-date-nav">
          <button
            type="button"
            className="hub-date-nav__arrow"
            aria-label={view === 'month' ? 'Previous month' : 'Previous day'}
            onClick={() => shiftView(-1)}
          >
            ‹
          </button>
          {view === 'day' ? (
            <label className="hub-date-nav__field">
              <input
                type="date"
                value={dateKey}
                onChange={(e) => selectDate(e.target.value)}
                aria-label="Schedule date"
              />
              <span>{formatDisplayDate(dateKey)}</span>
              <CalendarIcon />
            </label>
          ) : (
            <span className="hub-date-nav__label hub-date-nav__label--month">
              {formatMonthLabel(yearMonth)}
            </span>
          )}
          <button
            type="button"
            className="hub-date-nav__arrow"
            aria-label={view === 'month' ? 'Next month' : 'Next day'}
            onClick={() => shiftView(1)}
          >
            ›
          </button>
          <button
            type="button"
            className="hub-date-nav__today"
            onClick={() => {
              selectDate(todayKey);
              setView(view);
            }}
          >
            Today
          </button>
        </div>

        <label className="hub-search">
          <span className="visually-hidden">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms, organizations, events…"
            aria-label="Search rooms, organizations, or events"
          />
        </label>

        <p className="hub-schedule__summary">
          {view === 'day'
            ? `${summary.eventCount} events · ${summary.roomsInUse} of ${summary.roomTotal} rooms in use${
                searchQuery ? ' · filtered' : ''
              }`
            : `${monthSummary.eventCount} events · ${monthSummary.daysWithEvents} days booked${
                searchQuery ? ' · filtered' : ''
              }`}
        </p>
      </div>

      {showForm && (
        <form className="hub-form" onSubmit={(e) => void handleSaveEvent(e)}>
          <div className="hub-form__head">
            <h2>{editing ? 'Edit event' : 'Add manual event'}</h2>
            <button
              type="button"
              className="hub-btn hub-btn--ghost"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Close
            </button>
          </div>
          <div className="hub-form__grid">
            <label>
              Room
              <select
                name="roomId"
                required
                defaultValue={editing?.roomId ?? activeRooms[0]?.id}
              >
                {activeRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Organization
              <input
                name="orgName"
                required
                defaultValue={editing?.orgNameRaw ?? ''}
              />
            </label>
            <label className="hub-form__span">
              Title / Post As
              <input name="title" required defaultValue={editing?.title ?? ''} />
            </label>
            <label>
              Start
              <input
                name="start"
                type="datetime-local"
                required
                defaultValue={
                  editing ? toLocalInputValue(editing.startTime) : undefined
                }
              />
            </label>
            <label>
              End
              <input
                name="end"
                type="datetime-local"
                required
                defaultValue={
                  editing ? toLocalInputValue(editing.endTime) : undefined
                }
              />
            </label>
          </div>
          <div className="hub-form__actions">
            {editing?.source === 'manual' && (
              <button
                type="button"
                className="hub-btn hub-btn--danger"
                onClick={() => void removeEvent(editing)}
              >
                Delete
              </button>
            )}
            <button type="submit" className="hub-btn hub-btn--primary">
              {editing ? 'Save changes' : 'Save manual event'}
            </button>
          </div>
        </form>
      )}

      {view === 'month' && (
        <MonthCalendar
          yearMonth={yearMonth}
          todayKey={todayKey}
          selectedKey={dateKey}
          byDay={monthSummary.byDay}
          onSelectDay={openDay}
        />
      )}

      {view === 'day' && sections.length === 0 && (
        <p className="hub-search-empty">
          {searchQuery
            ? `No rooms, organizations, or events match “${search.trim()}”.`
            : 'No active rooms.'}
        </p>
      )}

      {view === 'day' &&
        sections.map((section) => (
          <div key={section.id} className="hub-section">
            <h2 className="hub-section__title">
              {section.title.toUpperCase()}
              <span className="hub-section__level"> · {section.level}</span>
            </h2>
            <div className="hub-room-grid">
              {section.rooms.map((room) => {
                const snaps = snapshotsForRoom(room, dateKey, events);
                const { primary } = pickCurrentAndNext(snaps, now, dateKey);
                const status = screenStatus(room, nowMs);
                return (
                  <a
                    key={room.id}
                    className="hub-room-card"
                    href={`/display/${room.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open /display/${room.id}`}
                  >
                    <div className="hub-room-card__top">
                      <h3>{room.displayName}</h3>
                      <StatusPill status={status} />
                    </div>

                    {primary ? (
                      <>
                        <div className="hub-room-card__event">
                          <div className="hub-room-card__title-row">
                            <strong>{primary.orgDisplayName}</strong>
                            <SourceBadge source={primary.source} />
                          </div>
                          <p>
                            {primary.title}
                            {primary.functionType &&
                            primary.functionType !== 'Manual'
                              ? ` · ${primary.functionType}`
                              : ''}
                          </p>
                        </div>
                        <div className="hub-room-card__foot">
                          <span>
                            {formatTimeRange(primary.startTime, primary.endTime)}
                          </span>
                          <button
                            type="button"
                            className="hub-room-card__edit"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEdit(primary);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="hub-room-card__empty">No events</p>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
    </section>
  );
}

function StatusPill({ status }: { status: ScreenStatus }) {
  const label = status === 'online' ? 'Online' : 'Offline';
  return (
    <span className={`hub-status hub-status--${status}`}>
      <span className="hub-status__dot" aria-hidden />
      {label}
    </span>
  );
}

function SourceBadge({ source }: { source: SignageEvent['source'] }) {
  const isCity = source === 'city' || source === 'delphi';
  return (
    <span className={isCity ? 'hub-badge hub-badge--city' : 'hub-badge'}>
      {isCity ? 'CITY' : 'Manual'}
    </span>
  );
}

function MonthCalendar({
  yearMonth,
  todayKey,
  selectedKey,
  byDay,
  onSelectDay,
}: {
  yearMonth: string;
  todayKey: string;
  selectedKey: string;
  byDay: Map<string, SignageEvent[]>;
  onSelectDay: (dateKey: string) => void;
}) {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0 Sun
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: Array<{ dateKey: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ dateKey, day });
  }

  return (
    <div className="hub-month">
      <div className="hub-month__weekdays" aria-hidden>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="hub-month__grid">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`e-${idx}`} className="hub-month__cell is-empty" />;
          }
          const dayEvents = (byDay.get(cell.dateKey) ?? []).filter(
            (e) => e.display !== false,
          );
          const rooms = new Set(dayEvents.map((e) => e.roomId));
          const orgs = [
            ...new Set(dayEvents.map((e) => e.orgNameRaw).filter(Boolean)),
          ].slice(0, 3);
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedKey;
          return (
            <button
              key={cell.dateKey}
              type="button"
              className={[
                'hub-month__cell',
                dayEvents.length ? 'has-events' : '',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDay(cell.dateKey)}
            >
              <span className="hub-month__daynum">{cell.day}</span>
              {dayEvents.length > 0 ? (
                <>
                  <span className="hub-month__count">
                    {dayEvents.length} events · {rooms.size} rooms
                  </span>
                  <ul className="hub-month__orgs">
                    {orgs.map((org) => (
                      <li key={org}>{org}</li>
                    ))}
                    {dayEvents.length > orgs.length && (
                      <li className="hub-month__more">
                        +{dayEvents.length - orgs.length} more
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <span className="hub-month__empty">No events</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="hub-date-nav__icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5 1.5v2.5M11 1.5v2.5M1.5 6.5h13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
