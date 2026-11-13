import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Requires an authenticated user WITH a completed profile.
export default function RequireProfile({ children }) {
  const { status, hasProfile } = useAuth();

  if (status === 'loading') {
    return <div className="container status">Loading…</div>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  if (!hasProfile) {
    return <Navigate to="/setup-profile" replace />;
  }
  return children;
}
