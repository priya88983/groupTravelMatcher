import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../services/api.js';
import { formatDate, formatInr } from '../utils/interests.js';

export default function MyGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getMyGroups()
      .then((data) => active && setGroups(data.groups))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <Layout>
      <div className="container wide">
        <span className="eyebrow">Your trips</span>
        <h1>My Groups</h1>
        <p>Groups where you are an approved member, including the ones you created.</p>

        {loading && <div className="status">Loading…</div>}
        {!loading && error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && groups.length === 0 && (
          <div className="card empty-state">
            <p>You are not part of any groups yet.</p>
            <div className="actions">
              <Link to="/create-group" className="button">Create a group</Link>
              <Link to="/search" className="button secondary">Find a group</Link>
            </div>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="card-grid">
            {groups.map((group) => (
              <div key={group.group_id} className="group-card card">
                <div className="group-card-top">
                  <span className="badge">{group.city}</span>
                  <span className={`badge ${group.role === 'CREATOR' ? 'badge-open' : ''}`}>
                    {group.role === 'CREATOR' ? 'Creator' : 'Member'}
                  </span>
                </div>
                <h3 className="group-card-title">{group.name}</h3>
                <p className="group-card-meta">
                  {formatDate(group.check_in)} → {formatDate(group.check_out)}
                </p>
                <p className="group-card-meta">
                  {group.member_count}/{group.max_size} members · {formatInr(group.budget_inr)} / person
                </p>
                <p className="group-card-meta">
                  Status: <strong>{group.status}</strong>
                </p>
                <Link to={`/groups/${group.group_id}`} className="button primary">Open details</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
