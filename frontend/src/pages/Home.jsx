
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

export default function Home() {
  const { user, traveller, logout } = useAuth();

  const firstName =
    traveller?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'traveller';

  return (
    <Layout>
      <div className="container">
        <span className="eyebrow">Group Travel Matcher</span>

        <h1>Hi, {firstName} 👋</h1>
        <p>Welcome back! Ready to explore your next adventure?</p>

        {traveller && (
          <div className="card">
            <p>
              <strong>{traveller.name}</strong> · {traveller.age} · {traveller.home_city}
            </p>

            <p className="hint">
              Interests: {traveller.interests?.join(', ')}
            </p>
          </div>
        )}

        <div className="actions">
          <Link to="/explore" className="button primary">
            Explore all groups
          </Link>

          {/* <Link to="/create-group" className="button">
            + Create Group
          </Link> */}

          <Link to="/my-groups" className="button secondary">
            My Groups
          </Link>
        </div>
      </div>
    </Layout>
  );
}
