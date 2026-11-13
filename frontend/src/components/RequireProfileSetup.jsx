import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Requires an authenticated user WITHOUT a profile yet (forces profile setup).
export default function RequireProfileSetup({ children }) {
  const { status, hasProfile } = useAuth();

  if (status === 'loading') {
    return <div className="container status">Loading…</div>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  if (hasProfile) {
    return <Navigate to="/" replace />;
  }
  return children;
}
