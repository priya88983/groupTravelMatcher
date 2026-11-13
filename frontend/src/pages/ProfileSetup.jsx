import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const GENDERS = ['FEMALE', 'MALE', 'OTHER'];
const GENDER_PREFERENCES = ['SAME_GENDER', 'OPPOSITE_GENDER', 'ANY'];

export default function ProfileSetup() {
  const { saveProfile } = useAuth();
  const navigate = useNavigate();

  const [interests, setInterests] = useState([]);
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'FEMALE',
    home_city: '',
    home_airport: '',
    gender_preference: 'ANY',
    interests: [],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.interests().then((data) => setInterests(data.interests)).catch(() => {});
  }, []);

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
    setBusy(true);
    try {
      await saveProfile({ ...form, age: Number(form.age), interests: form.interests });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <span className="eyebrow">Almost there</span>
      <h1>Set up your traveller profile</h1>
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
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label>
          Home city
          <input value={form.home_city} onChange={update('home_city')} required />
        </label>

        <label>
          Home airport
          <input value={form.home_airport} onChange={update('home_airport')} placeholder="e.g. BLR" maxLength="3" required />
        </label>

        <label>
          Grouping preference
          <select value={form.gender_preference} onChange={update('gender_preference')}>
            {GENDER_PREFERENCES.map((g) => (
              <option key={g} value={g}>{g.replace('_', ' ')}</option>
            ))}
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
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </main>
  );
}
