import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Login/Signup pages: only visible when logged out.
export default function PublicOnly({ children }) {
  const { status, hasProfile } = useAuth();

  if (status === 'loading') {
    return <div className="container status">Loading…</div>;
  }
  if (status === 'authenticated') {
    return <Navigate to={hasProfile ? '/' : '/setup-profile'} replace />;
  }
  return children;
}
