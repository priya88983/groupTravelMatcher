import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/create-group', label: 'Create Group' },
  { to: '/search', label: 'Search' },
  { to: '/my-groups', label: 'My Groups' },
  { to: '/profile', label: 'Profile' },
];

export default function Layout({ children }) {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topnav">
        <Link to="/" className="brand">Group Travel Matcher</Link>
        <nav className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              end={link.to === '/'}
            >
              {link.label}
            </NavLink>
          ))}
          <button type="button" className="text-button nav-logout" onClick={logout}>Log out</button>
        </nav>
      </header>
      <main className="page-main">{children}</main>
    </div>
  );
}
