import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const GENDERS = ['FEMALE', 'MALE', 'OTHER'];
const GENDER_PREFERENCES = ['SAME_GENDER', 'OPPOSITE_GENDER', 'ANY'];

export default function Profile() {
  const { traveller, saveProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [interests, setInterests] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.interests().then((data) => setInterests(data.interests)).catch(() => {});
  }, []);

  useEffect(() => {
    if (traveller && !form) {
      setForm({
        name: traveller.name,
        age: String(traveller.age),
        gender: traveller.gender,
        home_city: traveller.home_city,
        home_airport: traveller.home_airport,
        gender_preference: traveller.gender_preference,
        interests: [...traveller.interests],
      });
    }
  }, [traveller, form]);

  if (!traveller || !form) {
    return (
      <main className="container">
        <p>Loading profile…</p>
      </main>
    );
  }

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
    setNotice('');
    setBusy(true);
    try {
      await saveProfile({ ...form, age: Number(form.age), interests: form.interests });
      setNotice('Profile updated.');
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <span className="eyebrow">Your profile</span>
      <h1>Profile</h1>

      {!editing ? (
        <>
          <dl className="profile-list">
            <div><dt>Name</dt><dd>{traveller.name}</dd></div>
            <div><dt>Age</dt><dd>{traveller.age}</dd></div>
            <div><dt>Gender</dt><dd>{traveller.gender}</dd></div>
            <div><dt>Home city</dt><dd>{traveller.home_city}</dd></div>
            <div><dt>Home airport</dt><dd>{traveller.home_airport}</dd></div>
            <div><dt>Grouping preference</dt><dd>{traveller.gender_preference.replace('_', ' ')}</dd></div>
            <div><dt>Interests</dt><dd>{traveller.interests.join(', ')}</dd></div>
          </dl>

          {notice && <div className="alert alert-success">{notice}</div>}

          <div className="actions">
            <button type="button" className="primary" onClick={() => setEditing(true)}>
              Edit Profile
            </button>
            <Link to="/" className="button secondary">Back home</Link>
          </div>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label>
            Full name
            <input value={form.name} onChange={update('name')} required />
          </label>
          <label>
            Age
            <input type="number" min="18" max="120" value={form.age} onChange={update('age')} required />
          </label>
          <label>
            Gender
            <select value={form.gender} onChange={update('gender')}>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label>
            Home city
            <input value={form.home_city} onChange={update('home_city')} required />
          </label>
          <label>
            Home airport
            <input value={form.home_airport} onChange={update('home_airport')} maxLength="3" required />
          </label>
          <label>
            Grouping preference
            <select value={form.gender_preference} onChange={update('gender_preference')}>
              {GENDER_PREFERENCES.map((g) => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Interests</legend>
            <div className="chips">
              {interests.map((entry) => (
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
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="button secondary" onClick={() => { setEditing(false); setError(''); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
