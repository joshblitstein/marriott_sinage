import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useParams, useSearchParams } from 'react-router-dom';
import { TemplateCanvas } from '../../components/cardTemplate/TemplateCanvas';
import { DisplayKioskControls } from '../../components/DisplayKioskControls';
import { useScreenPresence } from '../../hooks/useScreenPresence';
import { useEnsureTodaySchedule } from '../../hooks/useEnsureTodaySchedule';
import {
  ensureSeedTemplates,
  resolvePublishedLayout,
  subscribeTemplateSettings,
  subscribeTemplates,
  type TemplateSettings,
} from '../../lib/cardTemplates';
import { db } from '../../lib/firebase';
import { levelLabelForRoom } from '../../lib/roomSections';
import { pickCurrentAndNext } from '../../lib/schedule';
import {
  dateKeyInHotelTz,
  formatClock,
  formatLongDate,
  formatTimeRange,
} from '../../lib/time';
import type { CardTemplate } from '../../types/templates';
import type { DisplayEventSnapshot, RoomDisplayDoc } from '../../types';

const CACHE_PREFIX = 'signage_display_';
const SHERATON_LOGO = '/brand/sheraton-logo.svg';

type RoomDoc = {
  name?: string;
  displayName?: string;
  active?: boolean;
  scheduleDateKey?: string;
  scheduleEvents?: DisplayEventSnapshot[];
  scheduleUpdatedAt?: string;
  templateId?: string | null;
};

export function DisplayPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const [data, setData] = useState<RoomDisplayDoc | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + slug);
      return raw ? (JSON.parse(raw) as RoomDisplayDoc) : null;
    } catch {
      return null;
    }
  });
  const [roomTemplateId, setRoomTemplateId] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [offline, setOffline] = useState(!navigator.onLine);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [tplSettings, setTplSettings] = useState<TemplateSettings | null>(null);

  useScreenPresence(
    !embed && slug && exists !== false ? ['rooms', slug] : null,
  );
  useEnsureTodaySchedule(exists !== false);

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
    void ensureSeedTemplates(db).catch(() => undefined);
    const unsubT = subscribeTemplates(db, setTemplates);
    const unsubS = subscribeTemplateSettings(db, setTplSettings);
    return () => {
      unsubT();
      unsubS();
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
        setRoomTemplateId(room.templateId ?? null);
        const nextDoc: RoomDisplayDoc = {
          roomId: slug,
          name: room.name ?? slug,
          displayName: room.displayName ?? room.name ?? slug,
          active: room.active !== false,
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

  const { next, primary, primaryMode } = useMemo(() => {
    const today = dateKeyInHotelTz(now);
    const eventsForToday =
      data?.dateKey === today ? (data.events ?? []) : [];
    return pickCurrentAndNext(eventsForToday, now, today);
  }, [data, now]);

  const resolved = useMemo(
    () =>
      resolvePublishedLayout(templates, tplSettings, {
        eventTemplateId: primary?.templateId,
        roomTemplateId,
      }),
    [templates, tplSettings, primary?.templateId, roomTemplateId],
  );

  if (exists === false && !data) {
    return (
      <>
        {!embed && <DisplayKioskControls />}
        <DoorEmpty roomName={slug} roomId={slug} />
      </>
    );
  }

  if (data && data.active === false) {
    return (
      <>
        {!embed && <DisplayKioskControls />}
        <div className="door-empty">
          <img className="door-empty__logo" src={SHERATON_LOGO} alt="Sheraton" />
          <div className="door-empty__rule" aria-hidden />
          <h1 className="door-empty__room">{data.displayName || slug}</h1>
          <p className="door-empty__level">Room inactive</p>
        </div>
      </>
    );
  }

  const roomName = data?.displayName || data?.name || slug;
  const roomId = data?.roomId || slug;
  const today = dateKeyInHotelTz(now);
  const events = data?.dateKey === today ? (data.events ?? []) : [];

  const level = levelLabelForRoom({ id: roomId });
  const displayTitle =
    primary?.displayTitle?.trim() ||
    primary?.title ||
    primary?.functionType ||
    '';
  const previewData = {
    roomName,
    level,
    orgDisplayName: primary?.orgDisplayName ?? (events.length ? '' : 'Available'),
    logoUrl: primary?.logoUrl ?? null,
    eventTitle: displayTitle || (events.length ? '' : 'No event in progress'),
    timeRange: primary
      ? formatTimeRange(primary.startTime, primary.endTime)
      : '',
    nextUp: next
      ? `Next ${formatTimeRange(next.startTime, next.endTime).split('–')[0]?.trim() ?? ''} · ${next.orgDisplayName}`
      : primaryMode === 'now'
        ? ''
        : primary
          ? `${primaryMode === 'next' ? 'Up next' : 'Today'} · ${primary.orgDisplayName}`
          : '',
    scheduleLines:
      events.length > 0
        ? events.map((ev) => {
            const title = ev.displayTitle?.trim() || ev.title;
            return `${formatTimeRange(ev.startTime, ev.endTime)} · ${ev.orgDisplayName}${title ? ` — ${title}` : ''}`;
          })
        : ['No events scheduled today'],
    footerLeft: formatLongDate(now),
    footerRight: 'Restrooms and elevators to the right',
    nowClock: formatClock(now),
    nowDate: formatLongDate(now),
  };

  // Prefer published template whenever one resolves (room / event / default)
  if (resolved) {
    return (
      <>
        {!embed && <DisplayKioskControls />}
        <div
          className={`door-template-stage${offline ? ' is-offline' : ''}${embed ? ' is-embed' : ''}`}
        >
          <TemplateCanvas
            themeId={resolved.template.themeId}
            elements={resolved.layout.elements}
            data={previewData}
            className="door-template-stage__canvas"
          />
        </div>
      </>
    );
  }

  if (events.length === 0) {
    return (
      <>
        {!embed && <DisplayKioskControls />}
        <DoorEmpty roomName={roomName} roomId={roomId} />
      </>
    );
  }

  return (
    <>
      {!embed && <DisplayKioskControls />}
      <div
        className={`door-template-stage${offline ? ' is-offline' : ''}${embed ? ' is-embed' : ''}`}
      >
        <FallbackClassic
          roomName={roomName}
          level={level}
          primary={primary}
          next={next}
          events={events}
          now={now}
          previewTitle={displayTitle}
        />
      </div>
    </>
  );
}

function DoorEmpty({
  roomName,
  roomId,
}: {
  roomName: string;
  roomId: string;
}) {
  const level = levelLabelForRoom({ id: roomId });
  return (
    <div className="door-empty">
      <img className="door-empty__logo" src={SHERATON_LOGO} alt="Sheraton" />
      <div className="door-empty__rule" aria-hidden />
      <h1 className="door-empty__room">{roomName}</h1>
      <p className="door-empty__level">{level}</p>
    </div>
  );
}

/** Used only until a template is published (seed usually publishes classic). */
function FallbackClassic({
  roomName,
  level,
  primary,
  next,
  events,
  now,
  previewTitle,
}: {
  roomName: string;
  level: string;
  primary: DisplayEventSnapshot | null;
  next: DisplayEventSnapshot | null;
  events: DisplayEventSnapshot[];
  now: Date;
  previewTitle: string;
}) {
  return (
    <div className="door-sign">
      <header className="door-sign__top">
        <img
          className="sheraton-mark__logo"
          src={SHERATON_LOGO}
          alt=""
          aria-hidden
        />
        <span className="door-sign__level">{level}</span>
      </header>
      <div className="door-sign__rule door-sign__rule--double" />
      <div className="door-sign__grid">
        <section className="door-sign__now-pane">
          <h1 className="door-sign__room">{roomName}</h1>
          {primary && (
            <>
              <h2 className="door-sign__org">{primary.orgDisplayName}</h2>
              <p className="door-sign__time">
                {formatTimeRange(primary.startTime, primary.endTime)}
                {previewTitle ? ` · ${previewTitle}` : ''}
              </p>
            </>
          )}
          {next && (
            <p className="door-sign__next-footer">
              Next {formatTimeRange(next.startTime, next.endTime).split('–')[0]}{' '}
              · {next.orgDisplayName}
            </p>
          )}
        </section>
        <ul className="door-sign__schedule-list">
          {events.map((ev) => (
            <li key={ev.id} className="door-sign__schedule-item">
              <span className="door-sign__schedule-time">
                {formatTimeRange(ev.startTime, ev.endTime)}
              </span>
              <span>
                {ev.orgDisplayName}
                {(ev.displayTitle || ev.title)
                  ? ` — ${ev.displayTitle || ev.title}`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="door-sign__rule" />
      <footer className="door-sign__footer">
        <span>{formatLongDate(now)}</span>
        <span>Restrooms and elevators to the right</span>
      </footer>
    </div>
  );
}
