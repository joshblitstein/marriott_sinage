import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { GlobalSearch } from '../../components/GlobalSearch';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { db } from '../../lib/firebase';
import {
  clearStagedCount,
  readStagedCount,
  subscribeStagedCount,
} from '../../lib/publishState';
import { isAdmin, isLead, roleLabel } from '../../lib/roles';
import { rebuildRoomDisplaysForDate } from '../../lib/schedule';
import { dateKeyInHotelTz } from '../../lib/time';
import { useEnsureTodaySchedule } from '../../hooks/useEnsureTodaySchedule';

const NAV: {
  to: string;
  label: string;
  end?: boolean;
  soon?: boolean;
  adminOnly?: boolean;
  leadOnly?: boolean;
}[] = [
  { to: '/admin', label: 'Schedule', end: true },
  { to: '/admin/floor-plan', label: 'Floor plan', adminOnly: true },
  { to: '/admin/import', label: 'Import', adminOnly: true },
  { to: '/admin/organizations', label: 'Organizations' },
  { to: '/admin/rooms', label: 'Rooms', adminOnly: true },
  { to: '/admin/status', label: 'Screens', adminOnly: true },
  { to: '/admin/accounts', label: 'Accounts', leadOnly: true },
  { to: '/admin/security', label: 'Security' },
  { to: '/admin/directory', label: 'Directory layout', adminOnly: true },
  { to: '/admin/history', label: 'History', leadOnly: true },
  { to: '/admin/preview', label: 'Preview' },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const [publishing, setPublishing] = useState(false);
  const [staged, setStaged] = useState(() => readStagedCount());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHotkey, setSearchHotkey] = useState('⌘K');
  const admin = isAdmin(user);
  const lead = isLead(user);

  useEnsureTodaySchedule(true);

  useEffect(() => subscribeStagedCount(() => setStaged(readStagedCount())), []);

  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    setSearchHotkey(mac ? '⌘K' : 'Ctrl+K');
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navItems = NAV.filter((item) => {
    if (item.adminOnly && !admin) return false;
    if (item.leadOnly && !lead) return false;
    return true;
  });

  async function publish() {
    setPublishing(true);
    try {
      const count = staged;
      await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
      clearStagedCount();
      setStaged(0);
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
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="hub">
      <header className="hub-chrome">
        <div className="hub-chrome__inner">
          <div className="hub-chrome__nav-row">
            <div className="hub-brand">
              <strong>Sheraton Charlotte</strong>
              <span className="hub-brand__sep">·</span>
              <span className="hub-brand__hub">Display Hub</span>
            </div>
            <nav className="hub-nav" aria-label="Admin">
              {navItems.map((item) =>
                item.soon ? (
                  <span
                    key={item.label}
                    className="hub-nav__link hub-nav__link--soon"
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? 'hub-nav__link is-active' : 'hub-nav__link'
                    }
                  >
                    {item.label}
                  </NavLink>
                ),
              )}
            </nav>
          </div>

          <div className="hub-chrome__actions">
            <button
              type="button"
              className="hub-btn hub-btn--soft hub-search-trigger"
              onClick={() => setSearchOpen(true)}
              title={`Search all tables (${searchHotkey})`}
            >
              Search
              <kbd>{searchHotkey}</kbd>
            </button>
            {admin && (
              <>
                {staged > 0 ? (
                  <span className="hub-staged">
                    {staged} staged change{staged === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="hub-staged hub-staged--clear">
                    All published
                  </span>
                )}
                <NavLink
                  to="/admin/preview"
                  className={({ isActive }) =>
                    isActive ? 'hub-btn hub-btn--soft is-active' : 'hub-btn hub-btn--soft'
                  }
                >
                  Preview
                </NavLink>
                <button
                  type="button"
                  className="hub-btn hub-btn--primary"
                  disabled={publishing}
                  onClick={() => void publish()}
                >
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              </>
            )}
            {!admin && (
              <NavLink to="/admin/preview" className="hub-btn hub-btn--soft">
                Preview
              </NavLink>
            )}
            <button
              type="button"
              className="hub-admin-link"
              onClick={() => void signOut()}
              title={
                user?.username
                  ? `Signed in as ${user.username} (${user.role})`
                  : 'Sign out'
              }
            >
              {user ? roleLabel(user.role) : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="hub-main">
        <Outlet />
      </main>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
