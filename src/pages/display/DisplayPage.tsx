import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { DisplayKioskControls } from '../../components/DisplayKioskControls';
import { OrgLogo } from '../../components/OrgLogo';
import { useScreenPresence } from '../../hooks/useScreenPresence';
import { db } from '../../lib/firebase';
import { pickCurrentAndNext } from '../../lib/schedule';
import {
  formatClock,
  formatLongDate,
  formatTimeRange,
} from '../../lib/time';
import type { DisplayEventSnapshot, RoomDisplayDoc } from '../../types';

const SLIDE_MS = 12_000;
const CACHE_PREFIX = 'signage_display_';

type RoomDoc = {
  name?: string;
  displayName?: string;
  active?: boolean;
  scheduleDateKey?: string;
  scheduleEvents?: DisplayEventSnapshot[];
  scheduleUpdatedAt?: string;
};

type DoorSlide = 'classic' | 'cards';

type DoorProps = {
  roomName: string;
  events: DisplayEventSnapshot[];
  primary: DisplayEventSnapshot | null;
  primaryMode: 'now' | 'next' | 'today' | null;
  next: DisplayEventSnapshot | null;
  now: Date;
  offline?: boolean;
};

export function DisplayPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [data, setData] = useState<RoomDisplayDoc | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + slug);
      return raw ? (JSON.parse(raw) as RoomDisplayDoc) : null;
    } catch {
      return null;
    }
  });
  const [exists, setExists] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [offline, setOffline] = useState(!navigator.onLine);
  const [slide, setSlide] = useState<DoorSlide>('classic');

  useScreenPresence(
    slug && exists !== false ? ['rooms', slug] : null,
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!slug) return;
    const unsub = onSnapshot(
      doc(db, 'rooms', slug),
      (snap) => {
        if (!snap.exists()) {
          setExists(false);
          return;
        }
        setExists(true);
        const room = snap.data() as RoomDoc;
        const nextDoc: RoomDisplayDoc = {
          roomId: slug,
          name: room.name ?? slug,
          displayName: room.displayName ?? room.name ?? slug,
          active: room.active ?? false,
          dateKey: room.scheduleDateKey ?? '',
          events: room.scheduleEvents ?? [],
          updatedAt: room.scheduleUpdatedAt ?? '',
        };
        setData(nextDoc);
        try {
          localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify(nextDoc));
        } catch {
          /* ignore */
        }
      },
      () => {
        /* keep cache */
      },
    );
    return unsub;
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => {
      setSlide((s) => (s === 'classic' ? 'cards' : 'classic'));
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  const { next, primary, primaryMode } = useMemo(
    () => pickCurrentAndNext(data?.events ?? [], now, data?.dateKey),
    [data, now],
  );

  if (exists === false && !data) {
    return (
      <>
        <DisplayKioskControls />
        <div className="door-sign door-sign--error">
          <header className="door-sign__brand">
            <SheratonMark />
          </header>
          <main className="door-sign__main">
            <p className="door-sign__eyebrow">Room not configured</p>
            <h1 className="door-sign__room">{slug}</h1>
            <p className="door-sign__muted">
              This display slug was not found. Check the URL or activate the room
              in Admin.
            </p>
          </main>
          <footer className="door-sign__footer">
            <span>{formatClock(now)}</span>
          </footer>
        </div>
      </>
    );
  }

  if (data && data.active === false) {
    return (
      <>
        <DisplayKioskControls />
        <div className="door-sign door-sign--error">
          <header className="door-sign__brand">
            <SheratonMark />
          </header>
          <main className="door-sign__main">
            <p className="door-sign__eyebrow">Room not configured</p>
            <h1 className="door-sign__room">{data.displayName || slug}</h1>
            <p className="door-sign__muted">
              This room is inactive. Activate it in Admin to show live bookings.
            </p>
          </main>
          <footer className="door-sign__footer">
            <span>{formatLongDate(now)}</span>
            <span>{formatClock(now)}</span>
          </footer>
        </div>
      </>
    );
  }

  const roomName = data?.displayName || data?.name || slug;
  const props: DoorProps = {
    roomName,
    events: data?.events ?? [],
    primary,
    primaryMode,
    next,
    now,
    offline,
  };

  return (
    <>
      <DisplayKioskControls />
      <div className="door-stage">
        <div key={slide} className="door-stage__slide">
          {slide === 'classic' ? (
            <DoorClassic {...props} />
          ) : (
            <DoorCards {...props} />
          )}
        </div>
        <div className="door-stage__dots" aria-hidden>
          <span
            className={
              slide === 'classic'
                ? 'door-stage__dot is-active'
                : 'door-stage__dot'
            }
          />
          <span
            className={
              slide === 'cards' ? 'door-stage__dot is-active' : 'door-stage__dot'
            }
          />
        </div>
      </div>
    </>
  );
}

/** PDF Template — flat ballroom door sign */
function DoorClassic({
  roomName,
  events,
  primary,
  primaryMode,
  next,
  now,
  offline,
}: DoorProps) {
  return (
    <div className={`door-sign ${offline ? 'door-sign--offline' : ''}`}>
      <header className="door-sign__top">
        <SheratonMark />
        <span className="door-sign__level">Level 2</span>
      </header>
      <div className="door-sign__rule door-sign__rule--double" />

      <div className="door-sign__grid">
        <section className="door-sign__now-pane">
          <h1 className="door-sign__room door-sign__room--teal">{roomName}</h1>

          {primary ? (
            <>
              <NowLabel mode={primaryMode} />
              <div className="door-sign__org-row">
                <OrgLogo
                  name={primary.orgDisplayName}
                  logoUrl={primary.logoUrl}
                  size={110}
                />
                <div>
                  <h2 className="door-sign__org">{primary.orgDisplayName}</h2>
                  <p className="door-sign__time">
                    {formatTimeRange(primary.startTime, primary.endTime)}
                    {primary.functionType ? ` · ${primary.functionType}` : ''}
                    {primary.title && primary.title !== primary.functionType
                      ? ` · ${primary.title}`
                      : ''}
                  </p>
                  <p className="door-sign__hosted">
                    Hosted by {primary.orgDisplayName}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="door-sign__now-label door-sign__now-label--available">
                Available
              </p>
              <p className="door-sign__available-copy">No event in progress</p>
            </>
          )}

          {primaryMode === 'now' && next && (
            <p className="door-sign__next-footer">
              Next {formatTimeRange(next.startTime, next.endTime).split('–')[0]}{' '}
              · {next.orgDisplayName}
              {next.title ? ` — ${next.title}` : ''}
            </p>
          )}
        </section>

        <ScheduleList
          events={events}
          primaryId={primary?.id}
          heading="Today in this room"
          plain
        />
      </div>

      <div className="door-sign__rule" />
      <footer className="door-sign__footer">
        <span>{formatLongDate(now)}</span>
        <span>Restrooms and elevators to the right</span>
      </footer>
    </div>
  );
}

/** PDF 4B — card-based ballroom door sign */
function DoorCards({
  roomName,
  events,
  primary,
  primaryMode,
  next,
  now,
  offline,
}: DoorProps) {
  return (
    <div className={`door-cards ${offline ? 'door-cards--offline' : ''}`}>
      <header className="door-cards__top">
        <div className="door-cards__brand">
          <SheratonMark />
          <p className="door-cards__level">Level 2</p>
        </div>
        <span className="door-cards__clock">{formatClock(now)}</span>
      </header>

      <h1 className="door-cards__room">{roomName}</h1>

      <div className="door-cards__grid">
        <section className="door-cards__col">
          <span className="door-cards__schedule-label" aria-hidden>
            &nbsp;
          </span>
          <div className="door-cards__panel door-cards__panel--now">
            {primary ? (
              <>
                <div className="door-cards__now-body">
                  <NowLabel mode={primaryMode} compact />
                  <h2 className="door-cards__org">{primary.orgDisplayName}</h2>
                  <p className="door-cards__meta">
                    {formatTimeRange(primary.startTime, primary.endTime)}
                    {primary.functionType ? ` · ${primary.functionType}` : ''}
                    {primary.title && primary.title !== primary.functionType
                      ? ` · ${primary.title}`
                      : ''}
                  </p>
                  <p className="door-cards__hosted">
                    Hosted by {primary.orgDisplayName}
                  </p>
                  <div className="door-cards__logo">
                    <OrgLogo
                      name={primary.orgDisplayName}
                      logoUrl={primary.logoUrl}
                      size={96}
                    />
                  </div>
                </div>
                {next && (
                  <p className="door-cards__next">
                    Next{' '}
                    {formatTimeRange(next.startTime, next.endTime).split('–')[0]}{' '}
                    · {next.orgDisplayName}
                    {next.title ? ` · ${next.title}` : ''}
                  </p>
                )}
              </>
            ) : (
              <div className="door-cards__now-body">
                <p className="door-sign__now-label door-sign__now-label--available">
                  Available
                </p>
                <p className="door-sign__available-copy">No event in progress</p>
              </div>
            )}
          </div>
        </section>

        <section className="door-cards__col">
          <h3 className="door-cards__schedule-label">Today in this room</h3>
          <div className="door-cards__panel door-cards__panel--schedule">
            <ScheduleList events={events} primaryId={primary?.id} plain />
          </div>
        </section>
      </div>

      <footer className="door-cards__footer">
        <span>{formatLongDate(now)}</span>
        <span>Restrooms and elevators to the right</span>
      </footer>
    </div>
  );
}

function NowLabel({
  mode,
  compact,
}: {
  mode: DoorProps['primaryMode'];
  compact?: boolean;
}) {
  if (mode === 'now') {
    return (
      <p className={`door-sign__now-label${compact ? ' is-compact' : ''}`}>
        <span className="door-sign__now-dot" />
        {compact ? 'Now' : 'Now in this room'}
      </p>
    );
  }
  return (
    <p className="door-sign__now-label door-sign__now-label--available">
      {mode === 'next' ? 'Up next' : 'Today in this room'}
    </p>
  );
}

function ScheduleList({
  events,
  primaryId,
  heading,
  plain,
}: {
  events: DisplayEventSnapshot[];
  primaryId?: string;
  heading?: string;
  plain?: boolean;
}) {
  return (
    <section className={plain ? undefined : 'door-sign__schedule-card'}>
      {heading && (
        <h3 className="door-sign__schedule-heading">{heading}</h3>
      )}
      <ul className="door-sign__schedule-list">
        {events.length === 0 && (
          <li className="door-sign__muted">No events scheduled</li>
        )}
        {events.map((ev) => {
          const isCurrent = primaryId === ev.id;
          return (
            <li
              key={ev.id}
              className={
                isCurrent
                  ? 'door-sign__schedule-item is-current'
                  : 'door-sign__schedule-item'
              }
            >
              <span className="door-sign__schedule-time">
                {formatTimeRange(ev.startTime, ev.endTime)}
              </span>
              <span className="door-sign__schedule-text">
                {ev.orgDisplayName}
                {ev.title ? ` — ${ev.title}` : ''}
                {ev.functionType ? ` · ${ev.functionType}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SheratonMark() {
  return (
    <div className="sheraton-mark">
      <div className="sheraton-mark__emblem" aria-hidden>
        S
      </div>
      <div className="sheraton-mark__text">
        <strong>SHERATON</strong>
        <span>Charlotte Hotel</span>
      </div>
    </div>
  );
}
