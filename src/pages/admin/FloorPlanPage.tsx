import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import {
  FLOORS,
  FLOOR_DIRECTORIES,
  roomMark,
  shortRoomLabel,
  type FloorId,
} from '../../lib/floorPlanLayout';
import {
  eventsForRoomDisplay,
  pickCurrentAndNext,
} from '../../lib/schedule';
import { isScreenOnline } from '../../lib/screenPresence';
import {
  dateKeyInHotelTz,
  formatTimeRange,
  HOTEL_TZ,
} from '../../lib/time';
import type { DisplayEventSnapshot, Room, SignageEvent } from '../../types';

type RoomWithSchedule = Room & {
  lastSeenAt?: string;
  screenOnline?: boolean;
  scheduleDateKey?: string;
  scheduleEvents?: DisplayEventSnapshot[];
};

type Occupancy = 'now' | 'later' | 'free';

type RoomView = {
  room: RoomWithSchedule;
  snaps: DisplayEventSnapshot[];
  occupancy: Occupancy;
  online: boolean;
  headline: string | null;
  subline: string | null;
};

const OFFICIAL_PLANS = [
  {
    id: 'cltwsf01',
    src: '/floor-plans/cltwsf01.png',
    title: 'Official plan 1',
  },
  {
    id: 'cltwsf02',
    src: '/floor-plans/cltwsf02.png',
    title: 'Official plan 2',
  },
] as const;

function snapshotsForRoom(
  room: RoomWithSchedule,
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

function formatPlanClock(now: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: HOTEL_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
}

function formatStartClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: HOTEL_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function buildRoomView(
  room: RoomWithSchedule,
  dateKey: string,
  dayEvents: SignageEvent[],
  now: Date,
  nowMs: number,
): RoomView {
  const snaps = snapshotsForRoom(room, dateKey, dayEvents);
  const { current, next } = pickCurrentAndNext(snaps, now, dateKey);
  const online = isScreenOnline(room, nowMs);

  let occupancy: Occupancy = 'free';
  let headline: string | null = null;
  let subline: string | null = null;

  if (current) {
    occupancy = 'now';
    headline = current.orgDisplayName || current.title;
    const fn = current.functionType && current.functionType !== 'Manual'
      ? current.functionType
      : null;
    subline = fn ? `Now · ${fn}` : 'Now';
  } else if (next) {
    occupancy = 'later';
    headline = next.orgDisplayName || next.title;
    const fn = next.functionType && next.functionType !== 'Manual'
      ? next.functionType
      : null;
    subline = fn
      ? `${formatStartClock(next.startTime)} · ${fn}`
      : formatStartClock(next.startTime);
  } else if (snaps.length > 0) {
    occupancy = 'later';
    const first = snaps[0];
    headline = first.orgDisplayName || first.title;
    subline = formatTimeRange(first.startTime, first.endTime);
  }

  return { room, snaps, occupancy, online, headline, subline };
}

export function FloorPlanPage() {
  const todayKey = dateKeyInHotelTz();
  const [floorId, setFloorId] = useState<FloorId>('first');
  const [rooms, setRooms] = useState<RoomWithSchedule[]>([]);
  const [events, setEvents] = useState<SignageEvent[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const floor = FLOORS.find((f) => f.id === floorId) ?? FLOORS[0];
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'rooms'), orderBy('sortOrder')),
      (snap) => {
        setRooms(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomWithSchedule),
        );
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'events'), where('dateKey', '==', todayKey)),
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
  }, [todayKey]);

  useEffect(() => {
    setSelectedId(null);
  }, [floorId]);

  const roomById = useMemo(() => {
    const map = new Map<string, RoomWithSchedule>();
    for (const room of rooms) map.set(room.id, room);
    return map;
  }, [rooms]);

  const views = useMemo(() => {
    const map = new Map<string, RoomView>();
    for (const id of floor.roomIds) {
      const room = roomById.get(id);
      if (!room) continue;
      map.set(id, buildRoomView(room, todayKey, events, now, nowMs));
    }
    return map;
  }, [floor.roomIds, roomById, todayKey, events, now, nowMs]);

  const summary = useMemo(() => {
    let inUse = 0;
    for (const id of floor.roomIds) {
      const view = views.get(id);
      if (view && view.occupancy === 'now') inUse += 1;
    }
    return { inUse, total: floor.roomIds.length };
  }, [floor.roomIds, views]);

  const selected = selectedId ? views.get(selectedId) ?? null : null;

  return (
    <section className="fp-page">
      <header className="fp-page__top">
        <div>
          <h1>Floor plan</h1>
          <p className="fp-page__meta">
            {floor.label} · {formatPlanClock(now)} · {summary.inUse} of{' '}
            {summary.total} rooms in use. {floor.blurb}
          </p>
        </div>
        <div className="fp-tabs" role="tablist" aria-label="Floor">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === floorId}
              className={
                f.id === floorId ? 'fp-tabs__btn is-active' : 'fp-tabs__btn'
              }
              onClick={() => setFloorId(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <ul className="fp-legend" aria-label="Legend">
        <li>
          <span className="fp-legend__swatch fp-legend__swatch--now" />
          In use now
        </li>
        <li>
          <span className="fp-legend__swatch fp-legend__swatch--later" />
          Booked later today
        </li>
        <li>
          <span className="fp-legend__swatch fp-legend__swatch--free" />
          Free
        </li>
        <li>
          <span className="fp-legend__swatch fp-legend__swatch--offline" />
          Screen offline
        </li>
        <li>
          <span className="fp-legend__dot" />
          Directory screen
        </li>
      </ul>

      <div className="fp-workspace">
        <div className={`fp-plan fp-plan--${floorId}`}>
          {floorId === 'first' && (
            <FirstFloorPlan
              views={views}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          {floorId === 'second' && (
            <SecondFloorPlan
              views={views}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          {floorId === 'lobby' && (
            <LobbyFloorPlan
              views={views}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <aside className="fp-detail" aria-live="polite">
          {selected ? (
            <RoomDetail view={selected} />
          ) : (
            <p className="fp-detail__empty">
              Select a room on the plan to see its schedule and screen.
            </p>
          )}
        </aside>
      </div>

      <details className="fp-official">
        <summary>Official Marriott floor-plan images</summary>
        <div className="fp-official__grid">
          {OFFICIAL_PLANS.map((plan) => (
            <a
              key={plan.id}
              href={plan.src}
              target="_blank"
              rel="noreferrer"
              className="fp-official__card"
            >
              <img src={plan.src} alt={plan.title} />
              <span>{plan.title}</span>
            </a>
          ))}
        </div>
        <p className="fp-official__source">
          Source:{' '}
          <a
            href="https://www.marriott.com/en-us/hotels/cltws-sheraton-charlotte-hotel/events/"
            target="_blank"
            rel="noreferrer"
          >
            marriott.com · Sheraton Charlotte · Events
          </a>
        </p>
      </details>
    </section>
  );
}

function RoomTile({
  view,
  selected,
  onSelect,
  className = '',
  compact,
}: {
  view: RoomView | undefined;
  selected: boolean;
  onSelect: (id: string) => void;
  className?: string;
  compact?: boolean;
}) {
  if (!view) return <div className={`fp-tile fp-tile--ghost ${className}`} />;

  const { room, occupancy, online, headline, subline } = view;
  const mark = roomMark(room.id);
  const label = compact
    ? mark ?? shortRoomLabel(room.displayName, room.id)
    : shortRoomLabel(room.displayName, room.id);

  const classes = [
    'fp-tile',
    `fp-tile--${occupancy}`,
    !online ? 'is-offline' : '',
    selected ? 'is-selected' : '',
    compact ? 'is-compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={() => onSelect(room.id)}
      aria-pressed={selected}
      title={room.displayName}
    >
      {mark && !compact && <span className="fp-tile__mark">{mark}</span>}
      <span className="fp-tile__name">{label}</span>
      {occupancy === 'free' || !headline ? (
        <span className="fp-tile__status">Free</span>
      ) : (
        <>
          <span className="fp-tile__event">{truncate(headline, compact ? 14 : 22)}</span>
          {subline && (
            <span className="fp-tile__sub">{truncate(subline, compact ? 16 : 24)}</span>
          )}
        </>
      )}
    </button>
  );
}

function DirectoryPin({ label }: { label: string }) {
  return (
    <div className="fp-dir" title={label}>
      <span className="fp-dir__dot" aria-hidden />
      <span className="fp-dir__label">{label}</span>
    </div>
  );
}

function Structure({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return <div className={`fp-structure ${className}`}>{label}</div>;
}

function ZoneLabel({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return <div className={`fp-zone ${className}`}>{children}</div>;
}

function FirstFloorPlan({
  views,
  selectedId,
  onSelect,
}: {
  views: Map<string, RoomView>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tile = (id: string, className?: string, compact?: boolean) => (
    <RoomTile
      view={views.get(id)}
      selected={selectedId === id}
      onSelect={onSelect}
      className={className}
      compact={compact}
    />
  );

  return (
    <div className="fp-first">
      <div className="fp-first__top">
        <ZoneLabel className="fp-first__preconvene">PRECONVENE</ZoneLabel>
        <div className="fp-first__governors">
          <span className="fp-group-label">Governor&apos;s Ballroom</span>
          <div className="fp-first__governors-row">
            {tile('governors-1', '', true)}
            {tile('governors-2', '', true)}
            {tile('governors-3', '', true)}
            {tile('governors-4', '', true)}
            {tile('governors-5', '', true)}
            {tile('governors-6', '', true)}
          </div>
        </div>
        <Structure label="Restrooms" className="fp-first__rr" />
      </div>

      <div className="fp-first__mid">
        <div className="fp-first__symphony">
          <span className="fp-group-label">Symphony Ballroom</span>
          <div className="fp-first__symphony-grid">
            <div className="fp-first__symphony-col">
              {tile('symphony-7')}
              {tile('symphony-6')}
              {tile('symphony-5')}
            </div>
            {tile('symphony-4', 'fp-first__symphony-mid')}
            <div className="fp-first__symphony-col">
              {tile('symphony-3')}
              {tile('symphony-2')}
              {tile('symphony-1')}
            </div>
          </div>
        </div>

        <div className="fp-first__center">
          <ZoneLabel>CONVENTION FOYER</ZoneLabel>
          <DirectoryPin label={FLOOR_DIRECTORIES.first[1].label} />
          <div className="fp-first__meck">
            <span className="fp-group-label">Mecklenburg</span>
            {tile('mecklenburg-1', '', true)}
            {tile('mecklenburg-2', '', true)}
            {tile('mecklenburg-3', '', true)}
          </div>
          <DirectoryPin label={FLOOR_DIRECTORIES.first[0].label} />
          <ZoneLabel>GOVERNOR&apos;S FOYER</ZoneLabel>
        </div>

        <div className="fp-first__carolina">
          <span className="fp-group-label">Carolina Ballroom</span>
          <div className="fp-first__carolina-grid">
            {tile('carolina-d')}
            {tile('carolina-e')}
            {tile('carolina-c')}
            {tile('carolina-a')}
          </div>
        </div>
      </div>

      <div className="fp-first__bottom">
        <ZoneLabel className="fp-first__arrow">← TO PARKING GARAGE</ZoneLabel>
        <Structure label="Elevators" />
        <Structure label="Stairs" />
        <ZoneLabel className="fp-first__arrow">TO RESTAURANT &amp; LOBBY →</ZoneLabel>
      </div>
    </div>
  );
}

function SecondFloorPlan({
  views,
  selectedId,
  onSelect,
}: {
  views: Map<string, RoomView>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tile = (id: string, className?: string) => (
    <RoomTile
      view={views.get(id)}
      selected={selectedId === id}
      onSelect={onSelect}
      className={className}
    />
  );

  return (
    <div className="fp-second">
      <div className="fp-second__rooms">
        {tile('executive-boardroom')}
        {tile('boardroom')}
        <div className="fp-second__cardinal">
          {tile('cardinal-1')}
          {tile('cardinal-2')}
          {tile('cardinal-3')}
          <span className="fp-group-label fp-group-label--bottom">
            Cardinal Ballroom
          </span>
        </div>
        <Structure label="Stairs" className="fp-second__stairs" />
        <Structure label="↕ Elevator" className="fp-second__elev" />
      </div>
      <div className="fp-second__foyer">
        <ZoneLabel>CARDINAL FOYER</ZoneLabel>
        <DirectoryPin label={FLOOR_DIRECTORIES.second[0].label} />
      </div>
    </div>
  );
}

function LobbyFloorPlan({
  views,
  selectedId,
  onSelect,
}: {
  views: Map<string, RoomView>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tile = (id: string, className?: string) => (
    <RoomTile
      view={views.get(id)}
      selected={selectedId === id}
      onSelect={onSelect}
      className={className}
    />
  );

  return (
    <div className="fp-lobby">
      <div className="fp-lobby__upper">
        {tile('craft-city', 'fp-lobby__craft')}
        {tile('piedmont-room', 'fp-lobby__piedmont')}
        {tile('tannin-toast-back', 'fp-lobby__tannin-back')}
        {tile('tannin-toast-pdr', 'fp-lobby__tannin-pdr')}
        {tile('cjs', 'fp-lobby__cjs')}
      </div>
      <div className="fp-lobby__lower">
        <div className="fp-lobby__dirs">
          <ZoneLabel>LOBBY</ZoneLabel>
          {FLOOR_DIRECTORIES.lobby.map((d) => (
            <DirectoryPin key={d.id} label={d.label} />
          ))}
        </div>
        {tile('rooftop-parlor', 'fp-lobby__parlor')}
        {tile('rooftop-patio', 'fp-lobby__patio')}
      </div>
    </div>
  );
}

function RoomDetail({ view }: { view: RoomView }) {
  const { room, snaps, occupancy, online, headline } = view;
  const occupancyLabel =
    occupancy === 'now'
      ? 'In use now'
      : occupancy === 'later'
        ? 'Booked later today'
        : 'Free';

  return (
    <div className="fp-detail__body">
      <p className="fp-detail__eyebrow">Room</p>
      <h2>{room.displayName}</h2>
      <div className="fp-detail__pills">
        <span className={`fp-pill fp-pill--${occupancy}`}>{occupancyLabel}</span>
        <span className={`fp-pill fp-pill--${online ? 'online' : 'offline'}`}>
          Screen {online ? 'online' : 'offline'}
        </span>
      </div>

      {headline && occupancy !== 'free' && (
        <p className="fp-detail__lead">{headline}</p>
      )}

      <h3>Today&apos;s schedule</h3>
      {snaps.length === 0 ? (
        <p className="fp-detail__muted">No events booked.</p>
      ) : (
        <ul className="fp-detail__list">
          {snaps.map((ev) => (
            <li key={ev.id}>
              <strong>{ev.orgDisplayName || ev.title}</strong>
              <span>
                {formatTimeRange(ev.startTime, ev.endTime)}
                {ev.functionType && ev.functionType !== 'Manual'
                  ? ` · ${ev.functionType}`
                  : ''}
              </span>
              {ev.title && ev.title !== ev.orgDisplayName && (
                <span className="fp-detail__muted">{ev.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="fp-detail__actions">
        <Link
          className="fp-detail__link"
          to={`/display/${room.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Open display
        </Link>
      </div>
    </div>
  );
}

export { OFFICIAL_PLANS as FLOOR_PLANS };
