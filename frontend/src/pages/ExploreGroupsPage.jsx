import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import GroupCard from '../components/GroupCard.jsx';
import { api } from '../services/api.js';

const DESTINATIONS = ['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'];

export default function ExploreGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.listGroups(city ? { city } : {})
      .then((data) => {
        if (!active) return;
        setGroups(data.groups);
        setTotal(data.total);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [city]);

  return (
    <Layout>
      <div className="container wide">
        <span className="eyebrow">Discover</span>
        <h1>Explore all groups</h1>
        <p>Browse all open group posts, including ones you may have created.</p>

        <div className="explore-layout">
          {/* FULL WIDTH CONTENT: ALL GROUPS */}
          <div className="explore-content" style={{ gridColumn: '1 / -1' }}>
            <div className="filter-bar">
              <label className="filter-label">
                Filter by city
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">All cities</option>
                  {DESTINATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <span className="hint">{total} group{total === 1 ? '' : 's'}</span>
            </div>

            {loading && <div className="status">Loading groups…</div>}
            {!loading && error && <div className="alert alert-error">{error}</div>}
            {!loading && !error && groups.length === 0 && (
              <div className="card empty-state">
                <p>No groups found. Try a different city or create a new group.</p>
              </div>
            )}
            {!loading && !error && groups.length > 0 && (
              <div className="card-grid">
                {groups.map((group) => <GroupCard key={group.group_id} group={group} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
