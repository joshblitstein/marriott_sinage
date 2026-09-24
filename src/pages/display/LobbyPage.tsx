import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { DisplayKioskControls } from '../../components/DisplayKioskControls';
import { OrgLogo } from '../../components/OrgLogo';
import { useCharlotteWeather } from '../../hooks/useCharlotteWeather';
import { useScreenPresence } from '../../hooks/useScreenPresence';
import { useEnsureTodaySchedule } from '../../hooks/useEnsureTodaySchedule';
import { db } from '../../lib/firebase';
import {
  dateKeyInHotelTz,
  formatClock,
  formatLongDate,
  formatTimeRange,
} from '../../lib/time';
import { formatWeatherLine } from '../../lib/weather';
import type {
  DisplayEventSnapshot,
  LobbyDirectorySettings,
  LobbyHappening,
} from '../../types';

type RoomRow = {
  id: string;
  displayName: string;
  name: string;
  active: boolean;
  scheduleDateKey?: string;
  scheduleEvents?: DisplayEventSnapshot[];
  sortOrder?: number;
};

export type LobbyEvent = {
  key: string;
  orgDisplayName: string;
  title: string;
  functionType: string;
  startTime: string;
  endTime: string;
  roomLabel: string;
  logoUrl: string | null;
  roomIds: string[];
};

type LobbyStatus = 'IN SESSION' | 'SET UP' | string;
type SlideId = 'directory' | 'welcome' | 'kiosk' | 'mosaic' | 'floorplan' | 'amenities';

const SLIDE_MS = 12_000;

const BALLROOM_GROUPS: { prefix: string; label: string }[] = [
  { prefix: 'symphony-', label: 'Symphony Ballroom' },
  { prefix: 'mecklenburg-', label: 'Mecklenburg Ballroom' },
  { prefix: 'carolina-', label: 'Carolina Ballroom' },
  { prefix: 'governors-', label: "Governor's Ballroom" },
  { prefix: 'cardinal-', label: 'Cardinal Ballroom' },
];

type SlideProps = {
  events: LobbyEvent[];
  happenings: LobbyHappening[];
  directory: LobbyDirectorySettings;
  now: Date;
  referenceNow: Date;
  weatherLine: string | null;
};

export function LobbyPage() {
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [happenings, setHappenings] = useState<LobbyHappening[]>([]);
  const [directory, setDirectory] = useState<LobbyDirectorySettings>({});
  const [now, setNow] = useState(() => new Date());
  const [slideIndex, setSlideIndex] = useState(0);
  const weather = useCharlotteWeather(true);
  const weatherLine = formatWeatherLine(weather);

  useScreenPresence(embed ? null : ['settings', 'lobby'], { id: 'lobby' });
  useEnsureTodaySchedule(true);

  useEffect(() => {
    if (!embed) return;
    document.documentElement.classList.add('display-embed');
    return () => document.documentElement.classList.remove('display-embed');
  }, [embed]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomRow);
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setRooms(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'lobbyHappenings'), orderBy('sortOrder')),
      (snap) => {
        setHappenings(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as LobbyHappening)
            .filter((h) => h.active !== false),
        );
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'lobbyDirectory'), (snap) => {
      setDirectory(
        snap.exists() ? (snap.data() as LobbyDirectorySettings) : {},
      );
    });
    return unsub;
  }, []);

  const todayKey = dateKeyInHotelTz(now);

  const scheduleRooms = useMemo(
    () =>
      rooms.map((room) =>
        room.scheduleDateKey === todayKey
          ? room
          : { ...room, scheduleEvents: [] as DisplayEventSnapshot[] },
      ),
    [rooms, todayKey],
  );

  const referenceNow = now;

  const events = useMemo(
    () => buildLobbyEvents(scheduleRooms.filter((r) => r.active !== false)),
    [scheduleRooms],
  );

  const visible = useMemo(() => {
    const t = referenceNow.getTime();
    return events
      .filter((e) => new Date(e.endTime).getTime() > t)
      .slice(0, 8);
  }, [events, referenceNow]);

  const slides: SlideId[] = useMemo(
    () =>
      embed
        ? ['directory']
        : visible.length === 0 && happenings.length === 0
          ? ['amenities', 'floorplan']
          : ['directory', 'welcome', 'kiosk', 'mosaic', 'floorplan'],
    [visible.length, happenings.length, embed],
  );

  useEffect(() => {
    setSlideIndex(0);
  }, [slides.join('|')]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, [slides]);

  const active = slides[slideIndex] ?? slides[0];
  const slideProps: SlideProps = {
    events: visible,
    happenings,
    directory,
    now,
    referenceNow,
    weatherLine,
  };

  return (
    <>
      {!embed && <DisplayKioskControls />}
      <div className={embed ? 'lobby-stage lobby-stage--embed' : 'lobby-stage'}>
        <div key={active} className="lobby-stage__slide">
          {active === 'directory' && <LobbyDirectory {...slideProps} />}
          {active === 'welcome' && <LobbyWelcome {...slideProps} />}
          {active === 'kiosk' && <LobbyKiosk {...slideProps} />}
          {active === 'mosaic' && <LobbyMosaic {...slideProps} />}
          {active === 'floorplan' && <LobbyFloorPlan now={now} />}
          {active === 'amenities' && (
            <LobbyAmenities now={now} weatherLine={weatherLine} />
          )}
        </div>
        {slides.length > 1 && (
          <div className="lobby-stage__dots" aria-hidden>
            {slides.map((id, i) => (
              <span
                key={id}
                className={
                  i === slideIndex
                    ? 'lobby-stage__dot is-active'
                    : 'lobby-stage__dot'
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Vertical lobby directory — meetings + hotel happenings + Charlotte weather */
function LobbyDirectory({
  events,
  happenings,
  directory,
  now,
  referenceNow,
  weatherLine,
}: SlideProps) {
  const welcome =
    directory.welcomeTitle?.trim() || 'Welcome to Sheraton Charlotte';
  const footerLeft =
    directory.footerLeft?.trim() || 'Meeting space on Levels 1 and 2';
  const footerRight =
    directory.footerRight?.trim() || 'Guest services · Lobby level';

  return (
    <div className="lobby-dir">
      <header className="lobby-dir__header">
        <SheratonBrand />
        <div className="lobby-dir__aside">
          <span className="lobby-dir__clock">{formatClock(now)}</span>
          <span className="lobby-dir__date">{formatLongDate(now)}</span>
          {weatherLine && (
            <span className="lobby-dir__weather">{weatherLine}</span>
          )}
        </div>
      </header>

      <div className="lobby-dir__title-block">
        <h1>{welcome}</h1>
        <div className="lobby-dir__rule" />
        <div className="lobby-dir__meta">
          <span className="lobby-dir__today">Today</span>
          <span>LEVEL 2 · GRAND FOYER</span>
        </div>
      </div>

      <ul className="lobby-dir__list">
        {events.map((ev) => {
          const status = lobbyStatus(ev, referenceNow);
          return (
            <li key={ev.key} className="lobby-dir__row">
              <div className="lobby-dir__row-main">
                <OrgLogo name={ev.orgDisplayName} logoUrl={ev.logoUrl} />
                <div className="lobby-dir__copy">
                  <h2 className="lobby-dir__event-title">{ev.orgDisplayName}</h2>
                  {(ev.title || ev.functionType) && (
                    <p className="lobby-dir__event-sub">
                      {[ev.title, ev.functionType].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="lobby-dir__event-detail">
                    <strong>{ev.roomLabel}</strong>{' '}
                    {formatTimeRange(ev.startTime, ev.endTime)}
                  </p>
                </div>
              </div>
              <StatusBadge status={status} />
            </li>
          );
        })}

        {happenings.map((item) => (
          <li key={item.id} className="lobby-dir__row lobby-dir__row--hotel">
            <div className="lobby-dir__row-main">
              <div className="lobby-dir__hotel-mark" aria-hidden>
                {(item.section || 'H').slice(0, 1).toUpperCase()}
              </div>
              <div className="lobby-dir__copy">
                <h2 className="lobby-dir__event-title">{item.title}</h2>
                {item.subtitle && (
                  <p className="lobby-dir__event-sub">{item.subtitle}</p>
                )}
                <p className="lobby-dir__event-detail">
                  {[item.section, item.detail].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          </li>
        ))}

        {events.length === 0 && happenings.length === 0 && (
          <li className="lobby-dir__empty">
            No meetings or hotel happenings listed right now.
          </li>
        )}
      </ul>

      <footer className="lobby-dir__footer">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </footer>
    </div>
  );
}

/** TEMPLATE 02 — Single featured welcome */
function LobbyWelcome({ events, now, referenceNow, weatherLine }: SlideProps) {
  const featured =
    events.find((e) => lobbyStatus(e, referenceNow) === 'IN SESSION') ??
    events[0];
  if (!featured) return <LobbyAmenities now={now} weatherLine={weatherLine} />;

  return (
    <div className="lobby-welcome">
      <header className="lobby-welcome__header">
        <SheratonBrand />
        <span className="lobby-welcome__date">{formatLongDate(now)}</span>
      </header>
      <p className="lobby-welcome__eyebrow">Today we welcome</p>
      <h1 className="lobby-welcome__title">
        {featured.title || featured.orgDisplayName}
      </h1>
      <p className="lobby-welcome__host">Hosted by {featured.orgDisplayName}</p>
      <div className="lobby-welcome__block">
        <p className="lobby-welcome__label">Location</p>
        <p className="lobby-welcome__room">{featured.roomLabel}</p>
        <p className="lobby-welcome__muted">Level 2 · Grand Foyer</p>
      </div>
      <div className="lobby-welcome__block">
        <p className="lobby-welcome__label">Schedule</p>
        <p className="lobby-welcome__time">
          {formatTimeRange(featured.startTime, featured.endTime)}
        </p>
        {featured.functionType && (
          <p className="lobby-welcome__muted">{featured.functionType}</p>
        )}
      </div>
      <footer className="lobby-welcome__footer">
        <span>
          {events.length > 1
            ? `${events.length - 1} other event${events.length > 2 ? 's' : ''} today`
            : 'No other events scheduled today'}
        </span>
        <span>Guest services · Lobby level</span>
      </footer>
    </div>
  );
}

/** DIRECTION · KIOSK — espresso bars */
function LobbyKiosk({ events, now, referenceNow }: SlideProps) {
  return (
    <div className="lobby-kiosk">
      <header className="lobby-kiosk__header">
        <div className="lobby-kiosk__you-are">
          <span className="lobby-kiosk__emblem">S</span>
          <div>
            <div className="lobby-kiosk__you-label">You are in</div>
            <div className="lobby-kiosk__you-place">The Lobby</div>
          </div>
        </div>
        <span className="lobby-kiosk__clock">{formatClock(now)}</span>
      </header>
      <div className="lobby-kiosk__body">
        <h1>Events</h1>
        <p className="lobby-kiosk__sub">Levels 1 and 2</p>
        <ul className="lobby-kiosk__list">
          {events.map((ev) => {
            const status = lobbyStatus(ev, referenceNow);
            return (
              <li key={ev.key} className="lobby-kiosk__row">
                <div>
                  <h2>{ev.orgDisplayName}</h2>
                  <p>
                    {ev.roomLabel} · {formatTimeRange(ev.startTime, ev.endTime)}
                    {ev.functionType ? ` · ${ev.functionType}` : ''}
                  </p>
                </div>
                <StatusBadge status={status} />
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="lobby-kiosk__footer">
        <span>Currently —</span>
        <span>{formatLongDate(now)}</span>
        <span>Guest services</span>
      </footer>
    </div>
  );
}

/** DIRECTION · MOSAIC tiles */
function LobbyMosaic({ events, now, referenceNow }: SlideProps) {
  const [hero, ...rest] = events;
  const grid = rest.slice(0, 4);
  const overflow = rest.slice(4);

  return (
    <div className="lobby-mosaic">
      <header className="lobby-mosaic__header">
        <div className="lobby-mosaic__you">
          <span className="lobby-mosaic__emblem">S</span>
          You are in the lobby
        </div>
        <span>{formatClock(now)}</span>
      </header>
      <div className="lobby-mosaic__grid">
        {hero && (
          <MosaicTile
            ev={hero}
            status={lobbyStatus(hero, referenceNow)}
            large
          />
        )}
        <div className="lobby-mosaic__pair">
          {grid.map((ev) => (
            <MosaicTile
              key={ev.key}
              ev={ev}
              status={lobbyStatus(ev, referenceNow)}
            />
          ))}
        </div>
        {overflow.map((ev) => (
          <div key={ev.key} className="lobby-mosaic__overflow">
            <strong>{ev.orgDisplayName}</strong>
            <span>
              {ev.roomLabel} · {formatTimeRange(ev.startTime, ev.endTime)}
            </span>
            <StatusBadge status={lobbyStatus(ev, referenceNow)} />
          </div>
        ))}
      </div>
      <footer className="lobby-mosaic__footer">
        <span>Currently —</span>
        <span>{formatLongDate(now)}</span>
        <span>Guest services</span>
      </footer>
    </div>
  );
}

function MosaicTile({
  ev,
  status,
  large,
}: {
  ev: LobbyEvent;
  status: LobbyStatus;
  large?: boolean;
}) {
  return (
    <article className={large ? 'mosaic-tile mosaic-tile--large' : 'mosaic-tile'}>
      <div className="mosaic-tile__brand">
        <OrgLogo name={ev.orgDisplayName} logoUrl={ev.logoUrl} />
        <div>
          <div className="mosaic-tile__org">{ev.orgDisplayName}</div>
          {ev.functionType && (
            <div className="mosaic-tile__fn">{ev.functionType}</div>
          )}
        </div>
      </div>
      <div className="mosaic-tile__meta">
        <div>
          <strong>{ev.title || ev.orgDisplayName}</strong>
          <p>
            {ev.roomLabel} · {formatTimeRange(ev.startTime, ev.endTime)}
          </p>
        </div>
        <StatusBadge status={status} light />
      </div>
    </article>
  );
}

/** Hotel meeting-space floor plans (from marriott.com events page) */
function LobbyFloorPlan({ now }: { now: Date }) {
  return (
    <div className="lobby-floorplan">
      <header className="lobby-floorplan__header">
        <SheratonBrand />
        <div className="lobby-floorplan__meta">
          <span>{formatLongDate(now)}</span>
          <span>{formatClock(now)}</span>
        </div>
      </header>
      <h1 className="lobby-floorplan__title">Meeting space floor plans</h1>
      <div className="lobby-floorplan__grid">
        <figure>
          <img
            src="/floor-plans/cltwsf01.png"
            alt="Sheraton Charlotte meeting room floor plan 1"
          />
        </figure>
        <figure>
          <img
            src="/floor-plans/cltwsf02.png"
            alt="Sheraton Charlotte meeting room floor plan 2"
          />
        </figure>
      </div>
    </div>
  );
}

/** Nothing booked — hotel amenities */
function LobbyAmenities({
  now,
  weatherLine,
}: {
  now: Date;
  weatherLine?: string | null;
}) {
  return (
    <div className="lobby-amenities">
      <header className="lobby-amenities__header">
        <SheratonBrand center />
      </header>
      <h1>Welcome</h1>
      <p className="lobby-amenities__date">
        {formatLongDate(now)}
        {weatherLine ? ` · ${weatherLine}` : ''}
        {' · '}
        No meetings scheduled today
      </p>
      <div className="lobby-amenities__rule" />
      <div className="lobby-amenities__sections">
        <section>
          <h3>Dining</h3>
          <strong>Hearth Kitchen &amp; Bar</strong>
          <p>Breakfast 6:30 – 11:00 AM · Dinner 5:00 – 10:00 PM · Lobby level</p>
        </section>
        <section>
          <h3>Fitness &amp; Pool</h3>
          <strong>Open 24 hours</strong>
          <p>Level 3 · Guest room key required</p>
        </section>
        <section>
          <h3>Meeting Space</h3>
          <strong>Levels 1 and 2</strong>
          <p>Mecklenburg, Symphony, Carolina, Governor&apos;s and Cardinal</p>
        </section>
        <section>
          <h3>Getting Around</h3>
          <strong>Charlotte Convention Center</strong>
          <p>Connected by skywalk · Level 2</p>
        </section>
      </div>
      <footer className="lobby-amenities__footer">
        Guest services · Lobby level · Dial 0 from any house phone
      </footer>
    </div>
  );
}

function SheratonBrand({ center }: { center?: boolean }) {
  return (
    <div className={center ? 'lobby-brand lobby-brand--center' : 'lobby-brand'}>
      <div className="lobby-brand__emblem" aria-hidden>
        S
      </div>
      <div className="lobby-brand__text">
        <strong>SHERATON</strong>
        <span>Charlotte Hotel</span>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  light,
}: {
  status: LobbyStatus;
  light?: boolean;
}) {
  const kind =
    status === 'IN SESSION'
      ? 'is-session'
      : status === 'SET UP'
        ? 'is-setup'
        : 'is-later';
  return (
    <span
      className={`lobby-status ${kind}${light ? ' is-light' : ''}`}
    >
      {status}
    </span>
  );
}

function buildLobbyEvents(rooms: RoomRow[]): LobbyEvent[] {
  const groups = new Map<
    string,
    LobbyEvent & { roomIds: string[]; roomNames: string[] }
  >();

  for (const room of rooms) {
    for (const ev of room.scheduleEvents ?? []) {
      if (ev.display === false) continue;
      const key = [ev.orgDisplayName, ev.title, ev.startTime, ev.endTime].join(
        '|',
      );
      const existing = groups.get(key);
      if (existing) {
        existing.roomIds.push(room.id);
        existing.roomNames.push(room.displayName || room.name);
      } else {
        groups.set(key, {
          key,
          orgDisplayName: ev.orgDisplayName,
          title: ev.title,
          functionType: ev.functionType,
          startTime: ev.startTime,
          endTime: ev.endTime,
          roomLabel: room.displayName || room.name,
          logoUrl: ev.logoUrl,
          roomIds: [room.id],
          roomNames: [room.displayName || room.name],
        });
      }
    }
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      roomLabel: labelForRooms(g.roomIds, g.roomNames),
    }))
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
}

function labelForRooms(roomIds: string[], roomNames: string[]): string {
  for (const group of BALLROOM_GROUPS) {
    const members = roomIds.filter((id) => id.startsWith(group.prefix));
    if (members.length >= 2 && members.length === roomIds.length) {
      return group.label;
    }
  }
  return [...new Set(roomNames)].join(', ');
}

function lobbyStatus(ev: LobbyEvent, now: Date): LobbyStatus {
  const t = now.getTime();
  const start = new Date(ev.startTime).getTime();
  const end = new Date(ev.endTime).getTime();
  if (t >= start && t < end) return 'IN SESSION';
  if (t < start && start - t <= 2 * 60 * 60 * 1000) return 'SET UP';
  if (t < start) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ev.startTime));
  }
  return '';
}
