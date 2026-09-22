import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import type { Room } from '../../types';

const OFFLINE_MS = 10 * 60 * 1000;
const LOBBY_URL_PATH = '/display/lobby';

type RoomWithSeen = Room & { lastSeenAt?: string };

export function StatusPage() {
  const [rooms, setRooms] = useState<RoomWithSeen[]>([]);
  const [lobbyLastSeen, setLobbyLastSeen] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
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
    const unsub = onSnapshot(doc(db, 'settings', 'lobby'), (snap) => {
      const data = snap.data();
      setLobbyLastSeen(
        data?.lastSeenAt ? String(data.lastSeenAt) : null,
      );
    });
    return unsub;
  }, []);

  const lobbyOnline = useMemo(() => {
    if (!lobbyLastSeen) return false;
    return now - new Date(lobbyLastSeen).getTime() < OFFLINE_MS;
  }, [lobbyLastSeen, now]);

  const rows = useMemo(() => {
    return rooms.map((room) => {
      const last = room.lastSeenAt ? new Date(room.lastSeenAt).getTime() : 0;
      const online = last > 0 && now - last < OFFLINE_MS;
      return { room, online, last };
    });
  }, [rooms, now]);

  function copyUrl(path: string) {
    void navigator.clipboard.writeText(`${window.location.origin}${path}`);
  }

  return (
    <section>
      <h1>Screen status</h1>
      <p>Offline if no heartbeat for more than 10 minutes.</p>

      <table className="table">
        <thead>
          <tr>
            <th>Screen</th>
            <th>Status</th>
            <th>Last seen</th>
            <th>Display URL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Lobby directory
              <div className="meta">Portrait · 43&quot; vertical</div>
            </td>
            <td>
              <span
                className={`status-dot ${lobbyOnline ? 'online' : 'offline'}`}
              />
              {lobbyOnline ? 'Online' : 'Offline'}
            </td>
            <td>
              {lobbyLastSeen
                ? new Date(lobbyLastSeen).toLocaleString()
                : 'Never'}
            </td>
            <td>
              <button
                type="button"
                className="secondary"
                onClick={() => copyUrl(LOBBY_URL_PATH)}
              >
                Copy /display/lobby
              </button>{' '}
              <Link to={LOBBY_URL_PATH} target="_blank" rel="noreferrer">
                Open
              </Link>
            </td>
          </tr>
          {rows.map(({ room, online, last }) => (
            <tr key={room.id}>
              <td>
                {room.displayName}
                {!room.active && <span className="meta"> · inactive</span>}
              </td>
              <td>
                <span
                  className={`status-dot ${online ? 'online' : 'offline'}`}
                />
                {online ? 'Online' : 'Offline'}
              </td>
              <td>{last ? new Date(last).toLocaleString() : 'Never'}</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => copyUrl(`/display/${room.id}`)}
                >
                  Copy /display/{room.id}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
