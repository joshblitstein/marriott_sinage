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
import { isScreenOnline } from '../../lib/screenPresence';
import type { Room } from '../../types';

const LOBBY_URL_PATH = '/display/lobby';

type RoomWithSeen = Room & {
  lastSeenAt?: string;
  screenOnline?: boolean;
};

export function StatusPage() {
  const [rooms, setRooms] = useState<RoomWithSeen[]>([]);
  const [lobbyPresence, setLobbyPresence] = useState<{
    lastSeenAt?: string;
    screenOnline?: boolean;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
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
      setLobbyPresence(
        data
          ? {
              lastSeenAt: data.lastSeenAt
                ? String(data.lastSeenAt)
                : undefined,
              screenOnline: Boolean(data.screenOnline),
            }
          : null,
      );
    });
    return unsub;
  }, []);

  const lobbyOnline = useMemo(
    () => isScreenOnline(lobbyPresence, now),
    [lobbyPresence, now],
  );

  const rows = useMemo(() => {
    return rooms.map((room) => {
      const online = isScreenOnline(room, now);
      const last = room.lastSeenAt ? new Date(room.lastSeenAt).getTime() : 0;
      return { room, online, last };
    });
  }, [rooms, now]);

  function copyUrl(path: string) {
    void navigator.clipboard.writeText(`${window.location.origin}${path}`);
  }

  return (
    <section>
      <h1>Screen status</h1>
      <p>
        Online while the display URL is open in a browser tab. Offline when that
        tab is closed (or if the tablet stops responding for ~45 seconds).
      </p>

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
              {lobbyPresence?.lastSeenAt
                ? new Date(lobbyPresence.lastSeenAt).toLocaleString()
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
