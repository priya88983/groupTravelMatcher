import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Requires an authenticated user WITHOUT a profile yet (forces profile setup).
export default function RequireProfileSetup({ children }) {
  const { status, profileStatus } = useAuth();

  if (status === 'loading' || profileStatus === 'loading') {
    return <div className="container status">Loading…</div>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  if (profileStatus === 'ready') {
    return <Navigate to="/" replace />;
  }
  // 'missing' (no profile) -> show setup form. 'error' (fetch failed) -> also
  // show setup so the user can retry rather than being silently redirected.
  return children;
}
