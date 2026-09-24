import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { db } from '../../lib/firebase';
import { isAdmin } from '../../lib/roles';
import type { LobbyDirectorySettings, LobbyHappening } from '../../types';

const SETTINGS_ID = 'lobbyDirectory';

const DEFAULT_SETTINGS: Required<
  Pick<LobbyDirectorySettings, 'welcomeTitle' | 'footerLeft' | 'footerRight'>
> = {
  welcomeTitle: 'Welcome to Sheraton Charlotte',
  footerLeft: 'Meeting space on Levels 1 and 2',
  footerRight: 'Guest services · Lobby level',
};

export function DirectoryPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [settings, setSettings] = useState<LobbyDirectorySettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<LobbyHappening[]>([]);
  const [welcomeTitle, setWelcomeTitle] = useState(DEFAULT_SETTINGS.welcomeTitle);
  const [footerLeft, setFooterLeft] = useState(DEFAULT_SETTINGS.footerLeft);
  const [footerRight, setFooterRight] = useState(DEFAULT_SETTINGS.footerRight);
  const [savingSettings, setSavingSettings] = useState(false);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const [draftSection, setDraftSection] = useState('Hotel');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', SETTINGS_ID), (snap) => {
      if (!snap.exists()) {
        setSettings(DEFAULT_SETTINGS);
        setWelcomeTitle(DEFAULT_SETTINGS.welcomeTitle);
        setFooterLeft(DEFAULT_SETTINGS.footerLeft);
        setFooterRight(DEFAULT_SETTINGS.footerRight);
        return;
      }
      const data = snap.data() as LobbyDirectorySettings;
      setSettings(data);
      setWelcomeTitle(data.welcomeTitle || DEFAULT_SETTINGS.welcomeTitle);
      setFooterLeft(data.footerLeft || DEFAULT_SETTINGS.footerLeft);
      setFooterRight(data.footerRight || DEFAULT_SETTINGS.footerRight);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'lobbyHappenings'), orderBy('sortOrder')),
      (snap) => {
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LobbyHappening),
        );
      },
    );
    return unsub;
  }, []);

  const activeCount = useMemo(
    () => items.filter((i) => i.active !== false).length,
    [items],
  );

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setSavingSettings(true);
    try {
      const payload: LobbyDirectorySettings = {
        welcomeTitle: welcomeTitle.trim() || DEFAULT_SETTINGS.welcomeTitle,
        footerLeft: footerLeft.trim(),
        footerRight: footerRight.trim(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'settings', SETTINGS_ID), payload, { merge: true });
      if (user) {
        await writeAuditLog(db, {
          actor: user,
          action: 'lobby.directory_update',
          entityType: 'lobby',
          entityId: SETTINGS_ID,
          summary: 'Updated lobby directory welcome / footers',
          status: 'live',
        });
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!admin || !draftTitle.trim()) return;
    setBusy(true);
    try {
      const id = `lh_${Date.now().toString(36)}`;
      const item: LobbyHappening = {
        id,
        title: draftTitle.trim(),
        subtitle: draftSubtitle.trim() || undefined,
        detail: draftDetail.trim() || undefined,
        section: draftSection.trim() || 'Hotel',
        sortOrder: items.length,
        active: true,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'lobbyHappenings', id), item);
      if (user) {
        await writeAuditLog(db, {
          actor: user,
          action: 'lobby.happening_create',
          entityType: 'lobby',
          entityId: id,
          summary: `Added lobby item “${item.title}”`,
          status: 'live',
        });
      }
      setDraftTitle('');
      setDraftSubtitle('');
      setDraftDetail('');
      setDraftSection('Hotel');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: LobbyHappening) {
    if (!admin) return;
    const next = !(item.active !== false);
    await updateDoc(doc(db, 'lobbyHappenings', item.id), {
      active: next,
      updatedAt: new Date().toISOString(),
    });
    if (user) {
      await writeAuditLog(db, {
        actor: user,
        action: 'lobby.happening_update',
        entityType: 'lobby',
        entityId: item.id,
        summary: `${next ? 'Showed' : 'Hid'} lobby item “${item.title}”`,
        status: 'live',
      });
    }
  }

  async function removeItem(item: LobbyHappening) {
    if (!admin) return;
    if (!confirm(`Remove “${item.title}” from the lobby directory?`)) return;
    await deleteDoc(doc(db, 'lobbyHappenings', item.id));
    if (user) {
      await writeAuditLog(db, {
        actor: user,
        action: 'lobby.happening_delete',
        entityType: 'lobby',
        entityId: item.id,
        summary: `Removed lobby item “${item.title}”`,
        status: 'live',
      });
    }
  }

  return (
    <section className="directory-page">
      <header className="directory-page__header">
        <div>
          <h1>Directory layout</h1>
          <p>
            Control the vertical lobby board: welcome line, footers, and extra
            hotel happenings shown alongside today&apos;s meetings. Weather for
            Charlotte updates automatically.
          </p>
        </div>
        <p className="directory-page__count">
          {activeCount} hotel item{activeCount === 1 ? '' : 's'} on directory
        </p>
      </header>

      <form className="directory-card" onSubmit={(e) => void saveSettings(e)}>
        <h2>Lobby chrome</h2>
        <label>
          Welcome headline
          <input
            value={welcomeTitle}
            onChange={(e) => setWelcomeTitle(e.target.value)}
            disabled={!admin}
            maxLength={80}
          />
        </label>
        <div className="directory-card__row">
          <label>
            Footer left
            <input
              value={footerLeft}
              onChange={(e) => setFooterLeft(e.target.value)}
              disabled={!admin}
              maxLength={80}
            />
          </label>
          <label>
            Footer right
            <input
              value={footerRight}
              onChange={(e) => setFooterRight(e.target.value)}
              disabled={!admin}
              maxLength={80}
            />
          </label>
        </div>
        {admin && (
          <button
            type="submit"
            className="hub-btn hub-btn--primary"
            disabled={savingSettings}
          >
            {savingSettings ? 'Saving…' : 'Save chrome'}
          </button>
        )}
        {!admin && (
          <p className="directory-page__hint">
            Viewing only — ask an admin to edit lobby copy.
          </p>
        )}
        <p className="directory-page__hint">
          Current welcome: {settings.welcomeTitle || DEFAULT_SETTINGS.welcomeTitle}
        </p>
      </form>

      {admin && (
        <form className="directory-card" onSubmit={(e) => void addItem(e)}>
          <h2>Add hotel happening</h2>
          <p className="directory-page__hint">
            Dining specials, spa hours, lobby events, convention center notes —
            anything guests should see that isn&apos;t a meeting-room booking.
          </p>
          <label>
            Title
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Live jazz at Hearth"
              required
              maxLength={80}
            />
          </label>
          <div className="directory-card__row">
            <label>
              Subtitle
              <input
                value={draftSubtitle}
                onChange={(e) => setDraftSubtitle(e.target.value)}
                placeholder="Hearth Kitchen & Bar"
                maxLength={80}
              />
            </label>
            <label>
              Section
              <input
                value={draftSection}
                onChange={(e) => setDraftSection(e.target.value)}
                placeholder="Hotel"
                maxLength={40}
              />
            </label>
          </div>
          <label>
            Detail / hours
            <input
              value={draftDetail}
              onChange={(e) => setDraftDetail(e.target.value)}
              placeholder="5:00 – 8:00 PM · Lobby level"
              maxLength={120}
            />
          </label>
          <button
            type="submit"
            className="hub-btn hub-btn--primary"
            disabled={busy || !draftTitle.trim()}
          >
            {busy ? 'Adding…' : 'Add to directory'}
          </button>
        </form>
      )}

      <div className="directory-card">
        <h2>On the lobby board</h2>
        {items.length === 0 ? (
          <p className="directory-page__hint">
            No hotel happenings yet. Meeting bookings still appear from the
            schedule.
          </p>
        ) : (
          <ul className="directory-list">
            {items.map((item) => (
              <li key={item.id} className={!item.active ? 'is-hidden' : undefined}>
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    {[item.section, item.subtitle, item.detail]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {admin && (
                  <div className="directory-list__actions">
                    <button
                      type="button"
                      className="hub-btn hub-btn--soft"
                      onClick={() => void toggleActive(item)}
                    >
                      {item.active !== false ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      className="hub-btn hub-btn--danger"
                      onClick={() => void removeItem(item)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
