import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireProfile from './components/RequireProfile.jsx';
import RequireProfileSetup from './components/RequireProfileSetup.jsx';
import PublicOnly from './components/PublicOnly.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import Profile from './pages/Profile.jsx';
import Home from './pages/Home.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
          <Route path="/setup-profile" element={<RequireProfileSetup><ProfileSetup /></RequireProfileSetup>} />
          <Route path="/profile" element={<RequireProfile><Profile /></RequireProfile>} />
          <Route path="/" element={<RequireProfile><Home /></RequireProfile>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
