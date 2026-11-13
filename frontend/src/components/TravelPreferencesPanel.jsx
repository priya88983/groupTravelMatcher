import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTravelPreferences, DESTINATIONS, MIN_DATE, MAX_DATE } from '../context/TravelPreferencesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useInterestLabels, formatInr } from '../utils/interests.js';

export default function TravelPreferencesPanel() {
  const { traveller } = useAuth();
  const labels = useInterestLabels();
  const {
    preferences,
    updatePreferences,
    hasCompletePreferences,
    validationErrors,
  } = useTravelPreferences();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(preferences);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setDraft(preferences);
    setSaved(false);
    setEditing(true);
  }

  function setField(field) {
    return (event) =>
      setDraft((d) => ({ ...d, [field]: event.target.value }));
  }

  function save() {
    updatePreferences(draft);
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  const genderLabel = (g) =>
    (g || '').replace('_', ' ').toLowerCase() || '—';
  const interests = traveller?.interests || [];

  return (
    <div className="card prefs-panel">
      <div className="prefs-panel-head">
        <h3>Your Travel Preferences</h3>
        {!editing && (
          <button type="button" className="text-button" onClick={startEdit}>
            Edit Preferences
          </button>
        )}
      </div>

      {editing ? (
        <div className="prefs-form">
          <label>
            Destination
            <select value={draft.destination} onChange={setField('destination')}>
              <option value="">Select a city</option>
              {DESTINATIONS.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>

          <div className="prefs-dates">
            <label>
              Check-in
              <input type="date" min={MIN_DATE} max={MAX_DATE} value={draft.check_in} onChange={setField('check_in')} />
            </label>
            <label>
              Check-out
              <input type="date" min={MIN_DATE} max={MAX_DATE} value={draft.check_out} onChange={setField('check_out')} />
            </label>
          </div>

          <label>
            Budget per person (INR)
            <input type="number" min="1" step="1" value={draft.budget_inr} onChange={setField('budget_inr')} placeholder="e.g. 60000" />
          </label>

          {Object.keys(validationErrors).length > 0 && (
            <ul className="prefs-errors">
              {Object.values(validationErrors).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}

          <div className="actions">
            <button type="button" className="primary" onClick={save}>
              Save Preferences
            </button>
            <button type="button" className="button secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {!hasCompletePreferences ? (
            <p className="hint prefs-empty">
              Set your destination, dates and budget to unlock matching and
              check compatibility with groups.
            </p>
          ) : (
            <dl className="profile-list prefs-summary">
              <div><dt>Destination</dt><dd>{preferences.destination}</dd></div>
              <div><dt>Check-in</dt><dd>{preferences.check_in}</dd></div>
              <div><dt>Check-out</dt><dd>{preferences.check_out}</dd></div>
              <div><dt>Budget</dt><dd>{formatInr(preferences.budget_inr)}</dd></div>
            </dl>
          )}

          {saved && <div className="alert alert-success">Preferences saved.</div>}

          <div className="prefs-profile-note">
            <p className="hint"><strong>Shared interests:</strong> {interests.length ? interests.map((i) => labels[i] || i).join(', ') : '—'}</p>
            <p className="hint"><strong>Gender preference:</strong> {genderLabel(traveller?.gender_preference)}</p>
            <Link to="/profile" className="text-button">Edit profile</Link>
          </div>
        </>
      )}
    </div>
  );
}
