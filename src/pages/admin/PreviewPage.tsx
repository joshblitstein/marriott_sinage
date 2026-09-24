import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { db } from '../../lib/firebase';
import { isAdmin } from '../../lib/roles';
import {
  clearStagedCount,
  readStagedCount,
  subscribeStagedCount,
} from '../../lib/publishState';
import { rebuildRoomDisplaysForDate } from '../../lib/schedule';
import { dateKeyInHotelTz } from '../../lib/time';
import type { Room } from '../../types';

type PreviewMode = 'live' | 'staged';

const PORTRAIT = { w: 1080, h: 1920 };
const LANDSCAPE = { w: 1920, h: 1080 };

function PreviewFrame({
  src,
  title,
  width,
  height,
  className,
}: {
  src: string;
  title: string;
  width: number;
  height: number;
  className: string;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const update = () => {
      const next = el.clientWidth / width;
      setScale(Number.isFinite(next) && next > 0 ? next : 0);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={shellRef}
      className={`preview-frame ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        className="preview-frame__scaler"
        style={{
          width,
          height,
          transform: scale ? `scale(${scale})` : undefined,
          opacity: scale ? 1 : 0,
        }}
      >
        <iframe
          title={title}
          src={src}
          className="preview-frame__iframe"
          width={width}
          height={height}
        />
      </div>
    </div>
  );
}

export function PreviewPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [mode, setMode] = useState<PreviewMode>('staged');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('carolina-c');
  const [staged, setStaged] = useState(() => readStagedCount());
  const [publishing, setPublishing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => subscribeStagedCount(() => setStaged(readStagedCount())), []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'rooms'), orderBy('sortOrder')),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Room)
          .filter((r) => r.active !== false);
        setRooms(list);
        setRoomId((current) => {
          if (list.some((r) => r.id === current)) return current;
          return list[0]?.id ?? 'lobby';
        });
      },
    );
    return unsub;
  }, []);

  const selected = useMemo(
    () => rooms.find((r) => r.id === roomId) ?? null,
    [rooms, roomId],
  );

  const lobbySrc = `/display/lobby?embed=1&mode=${mode}&t=${frameKey}`;
  const roomSrc = `/display/${roomId}?embed=1&mode=${mode}&t=${frameKey}`;

  async function publish() {
    if (!admin) return;
    setPublishing(true);
    try {
      const count = staged;
      await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
      clearStagedCount();
      setStaged(0);
      setFrameKey((k) => k + 1);
      if (user) {
        await writeAuditLog(db, {
          actor: user,
          action: 'publish',
          entityType: 'publish',
          entityId: dateKeyInHotelTz(),
          status: 'live',
          summary:
            count > 0
              ? `Published ${count} change${count === 1 ? '' : 's'}`
              : 'Published displays',
        });
      }
      setMode('live');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="preview-page">
      <header className="preview-page__header">
        <div>
          <h1>Preview</h1>
          <p>
            {mode === 'staged'
              ? `Showing staged content (${staged} staged change${staged === 1 ? '' : 's'}). Switch to Live to see what guests see now.`
              : 'Showing live content — what guest tablets show right now.'}
          </p>
        </div>
        <div className="preview-page__controls">
          <div className="preview-mode" role="group" aria-label="Preview mode">
            <button
              type="button"
              className={mode === 'live' ? 'is-active' : undefined}
              onClick={() => setMode('live')}
            >
              Live
            </button>
            <button
              type="button"
              className={mode === 'staged' ? 'is-active' : undefined}
              onClick={() => setMode('staged')}
            >
              Staged
            </button>
          </div>
          {admin && (
            <button
              type="button"
              className="hub-btn hub-btn--primary"
              disabled={publishing}
              onClick={() => void publish()}
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </header>

      <div className="preview-page__grid">
        <section className="preview-panel">
          <div className="preview-panel__bar">
            <h2>Lobby directory · Portrait</h2>
            <div className="preview-panel__room">
              <Link
                className="preview-panel__path"
                to="/display/lobby"
                target="_blank"
                rel="noreferrer"
              >
                /display/lobby
              </Link>
              {admin && (
                <Link className="preview-panel__edit" to="/admin/directory">
                  Edit lobby content
                </Link>
              )}
            </div>
          </div>
          <PreviewFrame
            className="preview-frame--portrait"
            title="Lobby directory preview"
            src={lobbySrc}
            width={PORTRAIT.w}
            height={PORTRAIT.h}
          />
          <p className="preview-panel__note">
            Charlotte weather updates automatically. Add dining, spa, and other
            hotel happenings under Directory layout.
          </p>
        </section>

        <section className="preview-panel">
          <div className="preview-panel__bar">
            <h2>Room display · Landscape</h2>
            <div className="preview-panel__room">
              <label>
                <span className="visually-hidden">Room</span>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName || r.name}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                className="preview-panel__path"
                to={`/display/${roomId}`}
                target="_blank"
                rel="noreferrer"
              >
                /display/{roomId}
              </Link>
            </div>
          </div>
          <PreviewFrame
            key={roomId}
            className="preview-frame--landscape"
            title={`${selected?.displayName ?? roomId} preview`}
            src={roomSrc}
            width={LANDSCAPE.w}
            height={LANDSCAPE.h}
          />
          <p className="preview-panel__note">
            1920×1080. Off-hours (23:00–06:00) the sign dims to the room name.
          </p>
        </section>
      </div>
    </section>
  );
}
