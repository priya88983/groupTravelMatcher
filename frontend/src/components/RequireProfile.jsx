import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Requires an authenticated user WITH a completed profile.
// Distinguishes a genuinely missing profile (-> setup-profile) from a failed
// profile API request (-> error state, never a redirect to setup-profile).
export default function RequireProfile({ children }) {
  const { status, profileStatus } = useAuth();

  if (status === 'loading' || profileStatus === 'loading') {
    return <div className="container status">Loading…</div>;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  if (profileStatus === 'missing') {
    return <Navigate to="/setup-profile" replace />;
  }
  if (profileStatus === 'error') {
    return (
      <div className="container status">
        <p>Could not load your profile. Please try again.</p>
        <a href="/profile">Retry</a>
      </div>
    );
  }
  return children;
}
