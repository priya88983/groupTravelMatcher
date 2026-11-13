import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../services/api.js';

const DESTINATIONS = ['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'];

const emptyForm = {
  name: '',
  city: '',
  check_in: '',
  check_out: '',
  max_size: 3,
  budget_inr: '',
  itinerary: '',
};

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { group } = await api.createGroup({
        ...form,
        name: form.name.trim(),
        city: form.city.trim(),
        max_size: Number(form.max_size),
        budget_inr: Number(form.budget_inr),
        itinerary: form.itinerary.trim(),
      });
      navigate(`/groups/${group.group_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="container">
        <span className="eyebrow">Group owner</span>
        <h1>Create a group post</h1>
        <p>Share your trip plan and invite compatible travellers to join.</p>

        <form onSubmit={onSubmit} noValidate>
          <label>
            Group name
            <input value={form.name} onChange={update('name')} placeholder="e.g. Kyoto Spring Temples" required />
          </label>
          <label>
            Destination
            <select value={form.city} onChange={update('city')} required>
              <option value="">Select a city</option>
              {DESTINATIONS.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>
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
          <div className="form-row">
            <label>
              Maximum group size (incl. you)
              <select value={form.max_size} onChange={update('max_size')}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>
              Approx. budget per person (INR)
              <input type="number" min="1" step="1" value={form.budget_inr} onChange={update('budget_inr')} placeholder="e.g. 60000" required />
            </label>
          </div>
          <label>
            Proposed itinerary
            <textarea value={form.itinerary} onChange={update('itinerary')} rows="4" placeholder="Describe your plan…" />
          </label>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
