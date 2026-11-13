import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await signup(form.email, form.password);
      navigate('/setup-profile', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <span className="eyebrow">Join</span>
      <h1>Create your account</h1>
      <p>After signing up you will complete your traveller profile.</p>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
        </label>
        <label>
          Password
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              required
            />
            <button type="button" className="text-button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="hint">At least 8 characters including letters and numbers.</span>
        </label>
        <label>
          Confirm password
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.confirm}
            onChange={update('confirm')}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="hint">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
