import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function App() {
  const [status, setStatus] = useState('Checking backend…');
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Backend not ready');
        return response.json();
      })
      .then((data) => setStatus(data.database === 'connected' ? 'API and SQLite connected' : 'Backend online; database unavailable'))
      .catch(() => setStatus('Backend unavailable — run npm run dev from the root.'));
  }, []);
  return (
    <main className="container">
      <span className="eyebrow">Initial setup</span>
      <h1>Group Travel Matcher</h1>
      <p>The foundation is ready for traveller profiles, trip posts and group matching.</p>
      <div className="status">{status}</div>
      <p className="hint">No authentication or trip features are included in this first commit.</p>
    </main>
  );
}
