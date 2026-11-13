import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import GroupCard from '../components/GroupCard.jsx';
import TravelPreferencesPanel from '../components/TravelPreferencesPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTravelPreferences } from '../context/TravelPreferencesContext.jsx';
import { api } from '../services/api.js';

export default function SearchGroupsPage() {
  const { traveller } = useAuth();
  const { preferences, hasCompletePreferences } = useTravelPreferences();

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (!hasCompletePreferences || !traveller) return;

    let active = true;
    setLoading(true);
    setError('');

    api
      .searchGroups({
        destination: preferences.destination,
        check_in: preferences.check_in,
        check_out: preferences.check_out,
        budget_inr: Number(preferences.budget_inr),
        interests: traveller.interests || [],
      })
      .then((data) => {
        if (!active) return;
        setResults(data.results);
        setRan(true);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setResults(null);
        setRan(true);
      })
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [hasCompletePreferences, traveller, preferences.destination, preferences.check_in, preferences.check_out, preferences.budget_inr]);

  return (
    <Layout>
      <div className="container wide">
        <span className="eyebrow">Matching</span>
        <h1>Find Matches</h1>
        <p>
          Matching by your saved preferences: {preferences.destination},{' '}
          {preferences.check_in} → {preferences.check_out}, budget ₹
          {preferences.budget_inr} / person.
        </p>

        <div className="explore-layout">
          {/* LEFT SIDEBAR: TRAVEL PREFERENCES */}
          <aside className="explore-sidebar">
            <TravelPreferencesPanel />
          </aside>

          {/* RIGHT CONTENT: MATCHING RESULTS */}
          <div className="explore-content">
            {!hasCompletePreferences ? (
              <div className="card empty-state">
                <p>
                  Set your travel preferences in the panel on the left so we
                  can find compatible groups for you.
                </p>
                <p className="hint">
                  Your preferences are saved once and reused across Find
                  Matches and Group Details.
                </p>
              </div>
            ) : (
              <>
                {loading && <div className="status">Finding matches…</div>}
                {!loading && error && (
                  <div className="alert alert-error">{error}</div>
                )}

                {!loading && !error && ran && (
                  <section className="results-section">
                    <h2>Matches ({results?.length ?? 0})</h2>
                    {!results || results.length === 0 ? (
                      <div className="card empty-state">
                        <p>
                          No eligible matches for your current preferences. Try
                          extending your dates, raising the budget, or choosing
                          a different destination.
                        </p>
                      </div>
                    ) : (
                      <div className="card-grid">
                        {results.map((result) => (
                          <GroupCard
                            key={result.group.group_id}
                            group={result.group}
                            match={{
                              explanations: result.eligibility.explanations,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
