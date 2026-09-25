import { useEffect, useState, type FormEvent } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { normalizeSpaceName } from '../../lib/normalize';
import { db } from '../../lib/firebase';
import { rebuildRoomDisplaysForDate } from '../../lib/schedule';
import { dateKeyInHotelTz } from '../../lib/time';
import { subscribeTemplates } from '../../lib/cardTemplates';
import type { Room } from '../../types';
import type { CardTemplate } from '../../types/templates';

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'rooms'), orderBy('sortOrder')),
      (snap) => {
        setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Room));
      },
    );
    return unsub;
  }, []);

  useEffect(() => subscribeTemplates(db, setTemplates), []);

  async function toggleActive(room: Room) {
    await updateDoc(doc(db, 'rooms', room.id), { active: !room.active });
    await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
  }

  async function saveAliases(room: Room, raw: string) {
    const bookingAliases = raw
      .split('\n')
      .map((l) => normalizeSpaceName(l))
      .filter(Boolean);
    await updateDoc(doc(db, 'rooms', room.id), { bookingAliases });
  }

  async function saveDisplayName(room: Room, displayName: string) {
    await updateDoc(doc(db, 'rooms', room.id), {
      displayName,
      name: displayName,
    });
    await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
  }

  async function saveTemplateId(room: Room, templateId: string) {
    await updateDoc(doc(db, 'rooms', room.id), {
      templateId: templateId || null,
    });
  }

  async function createRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = String(fd.get('slug'))
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const name = String(fd.get('name')).trim();
    if (!id || !name) return;
    if (id === 'lobby') {
      alert('Slug "lobby" is reserved for the lobby directory screen.');
      return;
    }
    if (rooms.some((r) => r.id === id)) {
      alert('Slug already exists — slugs cannot be changed after creation.');
      return;
    }
    const room: Room = {
      id,
      name,
      displayName: name,
      bookingAliases: [normalizeSpaceName(name)],
      sortOrder: rooms.length + 1,
      active: true,
    };
    await setDoc(doc(db, 'rooms', id), room);
    await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
    setShowCreate(false);
  }

  function copyUrl(pathOrSlug: string) {
    const path = pathOrSlug.startsWith('/')
      ? pathOrSlug
      : `/display/${pathOrSlug}`;
    void navigator.clipboard.writeText(`${window.location.origin}${path}`);
  }

  return (
    <section>
      <h1>Rooms</h1>
      <p>
        Slugs are permanent and become the display URL. Renaming a room does not
        change its slug.
      </p>

      <div className="admin-toolbar">
        <button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Close' : 'Add room'}
        </button>
      </div>

      {showCreate && (
        <form
          className="login-form"
          onSubmit={createRoom}
          style={{ maxWidth: 420, marginBottom: '1.5rem' }}
        >
          <label>
            Display name
            <input name="name" required />
          </label>
          <label>
            Slug (permanent)
            <input name="slug" required placeholder="e.g. symphony-8" />
          </label>
          <p className="meta">Warning: slug cannot be edited later.</p>
          <button type="submit">Create room</button>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Slug / URL</th>
            <th>Active</th>
            <th>Card template</th>
            <th>Booking aliases (one per line)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Lobby directory</strong>
              <div className="meta">
                Portrait · 43&quot; vertical · all-room today&apos;s events
              </div>
            </td>
            <td>
              <code>lobby</code>
              <div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => copyUrl('/display/lobby')}
                >
                  Copy /display/lobby
                </button>{' '}
                <Link to="/display/lobby" target="_blank" rel="noreferrer">
                  Open
                </Link>
              </div>
            </td>
            <td>
              <span className="meta">Always on</span>
            </td>
            <td>
              <span className="meta">—</span>
            </td>
            <td>
              <span className="meta">Aggregates active rooms — no aliases</span>
            </td>
          </tr>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>
                <input
                  defaultValue={room.displayName}
                  onBlur={(e) => {
                    if (e.target.value !== room.displayName) {
                      void saveDisplayName(room, e.target.value);
                    }
                  }}
                />
              </td>
              <td>
                <code>{room.id}</code>
                <div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => copyUrl(room.id)}
                  >
                    Copy /display/{room.id}
                  </button>
                </div>
              </td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void toggleActive(room)}
                >
                  {room.active ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td>
                <select
                  value={room.templateId ?? ''}
                  onChange={(e) => void saveTemplateId(room, e.target.value)}
                >
                  <option value="">Global default</option>
                  {templates
                    .filter((t) => t.published)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                {templates.length > 0 &&
                  templates.every((t) => !t.published) && (
                    <div className="meta">
                      No published templates yet — open Card templates and
                      Publish one first.
                    </div>
                  )}
              </td>
              <td>
                <textarea
                  rows={3}
                  defaultValue={room.bookingAliases.join('\n')}
                  onBlur={(e) => void saveAliases(room, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
