import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user, traveller, logout } = useAuth();
  const firstName = traveller?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'traveller';

  return (
    <main className="container">
      <span className="eyebrow">Group Travel Matcher</span>
      <h1>Hi, {firstName} 👋</h1>
      <p>You are logged in and your traveller profile is complete.</p>

      {traveller && (
        <div className="card">
          <p><strong>{traveller.name}</strong> · {traveller.age} · {traveller.home_city}</p>
          <p className="hint">Interests: {traveller.interests.join(', ')}</p>
        </div>
      )}

      <div className="actions">
        <Link to="/profile" className="button">View / edit profile</Link>
        <button type="button" className="button secondary" onClick={logout}>Log out</button>
      </div>

      <p className="hint">Matching and group features will be added in later commits.</p>
    </main>
  );
}
