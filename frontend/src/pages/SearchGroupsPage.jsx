import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import GroupCard from '../components/GroupCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { useInterestLabels } from '../utils/interests.js';

const DESTINATIONS = ['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'];
const GENDER_PREFERENCES = ['SAME_GENDER', 'OPPOSITE_GENDER', 'ANY'];

export default function SearchGroupsPage() {
  const { traveller } = useAuth();
  const labels = useInterestLabels();

  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.interests().then((data) => setCatalog(data.interests)).catch(() => {});
  }, []);

  useEffect(() => {
    if (traveller && !form) {
      setForm({
        destination: '',
        check_in: '',
        check_out: '',
        budget_inr: '',
        interests: [...traveller.interests],
        gender_preference: traveller.gender_preference,
      });
    }
  }, [traveller, form]);

  function update(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  function toggleInterest(interest) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : [...f.interests, interest],
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.searchGroups({
        ...form,
        destination: form.destination.trim(),
        budget_inr: Number(form.budget_inr),
      });
      setResults(data.results);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  if (!form) {
    return (<Layout><div className="container status">Loading…</div></Layout>);
  }

  return (
    <Layout>
      <div className="container wide">
        <span className="eyebrow">Matching</span>
        <h1>Find a group</h1>
        <p>Search strict matches: same destination, overlapping dates, compatible budget, shared interests, and gender preference.</p>

        <form onSubmit={onSubmit} noValidate className="search-form">
          <div className="form-row">
            <label>
              Destination
              <select value={form.destination} onChange={update('destination')} required>
                <option value="">Select a city</option>
                {DESTINATIONS.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
            <label>
              Budget per person (INR)
              <input type="number" min="1" value={form.budget_inr} onChange={update('budget_inr')} placeholder="e.g. 60000" required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Check-in
              <input type="date" value={form.check_in} onChange={update('check_in')} min="2027-04-01" max="2027-04-20" required />
            </label>
            <label>
              Check-out
              <input type="date" value={form.check_out} onChange={update('check_out')} min="2027-04-01" max="2027-04-20" required />
            </label>
          </div>
          <label>
            Gender preference
            <select value={form.gender_preference} onChange={update('gender_preference')}>
              {GENDER_PREFERENCES.map((g) => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Interests (shared with the group owner)</legend>
            <div className="chips">
              {catalog.map((entry) => (
                <button
                  type="button"
                  key={entry.interest}
                  className={form.interests.includes(entry.interest) ? 'chip chip-active' : 'chip'}
                  onClick={() => toggleInterest(entry.interest)}
                  aria-pressed={form.interests.includes(entry.interest)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </fieldset>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="actions">
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Searching…' : 'Search matches'}
            </button>
          </div>
        </form>

        {results && (
          <section className="results-section">
            <h2>Matches ({results.length})</h2>
            {results.length === 0 ? (
              <div className="card empty-state">
                <p>No strict matches found. Try extending your dates, raising the budget, or adding interests.</p>
              </div>
            ) : (
              <div className="card-grid">
                {results.map((result) => (
                  <GroupCard
                    key={result.group.group_id}
                    group={result.group}
                    match={{ explanations: result.eligibility.explanations }}
                  />
                ))}
              </div>
            )}
            {labels && null}
          </section>
        )}
      </div>
    </Layout>
  );
}
