import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Login/Signup pages: only visible when logged out.
export default function PublicOnly({ children }) {
  const { status, profileStatus } = useAuth();

  if (status === 'loading' || profileStatus === 'loading') {
    return <div className="container status">Loading…</div>;
  }
  if (status === 'authenticated') {
    return <Navigate to={profileStatus === 'ready' ? '/' : '/setup-profile'} replace />;
  }
  return children;
}
