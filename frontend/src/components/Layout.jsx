
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/search', label: 'Find Matches' },
  { to: '/my-groups', label: 'My Groups' },
  { to: '/profile', label: 'Profile' },
];

export default function Layout({ children }) {
  const { logout, traveller } = useAuth();

  return (
    <div className="app-shell">
      <header className="topnav">
        <div className="navbar-container">

          {/* BRAND */}
          <Link to="/" className="nav-brand">
            <span className="brand-icon">✈</span>
            <span>Group<span className="brand-accent">Travel</span></span>
          </Link>

          {/* NAVIGATION */}
          <nav className="nav-links" aria-label="Main navigation">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* ACTIONS */}
          <div className="nav-actions">
            <NavLink to="/create-group" className="nav-create-btn">
              + Create Group
            </NavLink>

            <span className="nav-user">
              {traveller?.name?.split(' ')[0] || 'Traveller'}
            </span>

            <button
              type="button"
              className="nav-logout-btn"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">
        {children}
      </main>
    </div>
  );
}
