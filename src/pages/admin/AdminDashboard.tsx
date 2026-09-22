import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { db } from '../../lib/firebase';
import { groupRoomsBySection } from '../../lib/roomSections';
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
import type { DisplayEventSnapshot, Room, SignageEvent } from '../../types';

const OFFLINE_MS = 10 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;

type RoomWithSeen = Room & {
  lastSeenAt?: string;
  scheduleDateKey?: string;
  scheduleEvents?: DisplayEventSnapshot[];
};
type ScreenStatus = 'online' | 'offline' | 'stale';

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

function screenStatus(lastSeenAt: string | undefined, nowMs: number): ScreenStatus {
  if (!lastSeenAt) return 'offline';
  const age = nowMs - new Date(lastSeenAt).getTime();
  if (age < OFFLINE_MS) return 'online';
  if (age < STALE_MS) return 'stale';
  return 'offline';
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
  const todayKey = dateKeyInHotelTz();
  const [dateKey, setDateKey] = useState(todayKey);
  const [rooms, setRooms] = useState<RoomWithSeen[]>([]);
  const [events, setEvents] = useState<SignageEvent[]>([]);
  const [monthEvents, setMonthEvents] = useState<SignageEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SignageEvent | null>(null);
  const [view, setView] = useState<'day' | 'month'>('day');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const yearMonth = dateKey.slice(0, 7);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
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

  const sections = useMemo(
    () => groupRoomsBySection(activeRooms),
    [activeRooms],
  );

  const summary = useMemo(() => {
    let eventCount = 0;
    let roomsInUse = 0;
    for (const room of activeRooms) {
      const snaps = snapshotsForRoom(room, dateKey, events);
      if (snaps.length > 0) {
        roomsInUse += 1;
        eventCount += snaps.length;
      }
    }
    return {
      eventCount,
      roomsInUse,
      roomTotal: activeRooms.length,
    };
  }, [activeRooms, dateKey, events]);

  const monthSummary = useMemo(() => {
    const visible = monthEvents.filter((e) => e.display !== false);
    const byDay = new Map<string, SignageEvent[]>();
    for (const ev of visible) {
      const list = byDay.get(ev.dateKey) ?? [];
      list.push(ev);
      byDay.set(ev.dateKey, list);
    }
    return {
      eventCount: visible.length,
      daysWithEvents: byDay.size,
      byDay,
    };
  }, [monthEvents]);

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
            Hotel time {HOTEL_TZ}. CITY bookings sync nightly; manual events are
            flagged where they overlap a booking.
          </p>
        </div>
        <div className="hub-schedule__cta">
          <Link className="hub-link" to="/admin/import">
            Import CITY file
          </Link>
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

        <p className="hub-schedule__summary">
          {view === 'day'
            ? `${summary.eventCount} events · ${summary.roomsInUse} of ${summary.roomTotal} rooms in use`
            : `${monthSummary.eventCount} events · ${monthSummary.daysWithEvents} days booked`}
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
                const status = screenStatus(room.lastSeenAt, nowMs);
                return (
                  <article key={room.id} className="hub-room-card">
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
                            onClick={() => openEdit(primary)}
                          >
                            Edit
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="hub-room-card__empty">No events</p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
    </section>
  );
}

function StatusPill({ status }: { status: ScreenStatus }) {
  const label =
    status === 'online' ? 'Online' : status === 'stale' ? 'Stale' : 'Offline';
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
