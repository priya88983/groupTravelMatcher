import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { TravelPreferencesProvider } from './context/TravelPreferencesContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireProfile from './components/RequireProfile.jsx';
import RequireProfileSetup from './components/RequireProfileSetup.jsx';
import PublicOnly from './components/PublicOnly.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import Profile from './pages/Profile.jsx';
import Home from './pages/Home.jsx';
import ExploreGroupsPage from './pages/ExploreGroupsPage.jsx';
import CreateGroupPage from './pages/CreateGroupPage.jsx';
import SearchGroupsPage from './pages/SearchGroupsPage.jsx';
import GroupDetailsPage from './pages/GroupDetailsPage.jsx';
import MyGroupsPage from './pages/MyGroupsPage.jsx';
import HotelPlanningPage from './pages/HotelPlanningPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <TravelPreferencesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
            <Route path="/setup-profile" element={<RequireProfileSetup><ProfileSetup /></RequireProfileSetup>} />
            <Route path="/profile" element={<RequireProfile><Profile /></RequireProfile>} />
            <Route path="/explore" element={<RequireProfile><ExploreGroupsPage /></RequireProfile>} />
            <Route path="/create-group" element={<RequireProfile><CreateGroupPage /></RequireProfile>} />
            <Route path="/search" element={<RequireProfile><SearchGroupsPage /></RequireProfile>} />
            <Route path="/groups/:groupId" element={<RequireProfile><GroupDetailsPage /></RequireProfile>} />
            <Route path="/groups/:groupId/hotels" element={<RequireProfile><HotelPlanningPage /></RequireProfile>} />
            <Route path="/my-groups" element={<RequireProfile><MyGroupsPage /></RequireProfile>} />
            <Route path="/" element={<RequireProfile><Home /></RequireProfile>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TravelPreferencesProvider>
    </AuthProvider>
  );
}
