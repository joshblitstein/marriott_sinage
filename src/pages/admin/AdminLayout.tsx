import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { isAdmin } from '../../lib/roles';
import { rebuildRoomDisplaysForDate } from '../../lib/schedule';
import { dateKeyInHotelTz } from '../../lib/time';

const NAV: {
  to: string;
  label: string;
  end?: boolean;
  soon?: boolean;
  adminOnly?: boolean;
}[] = [
  { to: '/admin', label: 'Schedule', end: true },
  { to: '/admin/floor-plan', label: 'Floor plan', adminOnly: true },
  { to: '/admin/import', label: 'Import', adminOnly: true },
  { to: '/admin/organizations', label: 'Organizations' },
  { to: '/admin/rooms', label: 'Rooms', adminOnly: true },
  { to: '/admin/status', label: 'Screens', adminOnly: true },
  { to: '/admin/directory', label: 'Directory layout', soon: true, adminOnly: true },
  { to: '/admin/history', label: 'History', soon: true, adminOnly: true },
  { to: '/display/lobby', label: 'Preview', adminOnly: true },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const [publishing, setPublishing] = useState(false);
  const [staged, setStaged] = useState(1);
  const admin = isAdmin(user);

  const navItems = NAV.filter((item) => admin || !item.adminOnly);

  async function publish() {
    setPublishing(true);
    try {
      await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
      setStaged(0);
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
                ) : item.to.startsWith('/display') ? (
                  <a
                    key={item.label}
                    className="hub-nav__link"
                    href={item.to}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
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
                <a
                  className="hub-btn hub-btn--soft"
                  href="/display/lobby"
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>
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
              {user?.role === 'manager' ? 'Manager' : 'Admin'}
            </button>
          </div>
        </div>
      </header>

      <main className="hub-main">
        <Outlet />
      </main>
    </div>
  );
}
