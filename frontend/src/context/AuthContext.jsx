import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken, clearAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [traveller, setTraveller] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated

  const applySession = useCallback((nextUser, nextTraveller) => {
    setUser(nextUser || null);
    setTraveller(nextTraveller ?? null);
    setStatus(nextUser ? 'authenticated' : 'unauthenticated');
  }, []);

  // Silent session restore: try the refresh endpoint once on application load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken, user: sessionUser } = await api.refresh();
        if (cancelled) return;
        setAccessToken(accessToken);
        setUser(sessionUser);
        setStatus('authenticated');
        try {
          const data = await api.me();
          if (!cancelled) setTraveller(data.traveller ?? null);
        } catch {
          if (!cancelled) setTraveller(null);
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          applySession(null, null);
        }
      } finally {
        if (!cancelled) setStatus((current) => (current === 'loading' ? 'unauthenticated' : current));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const hydrate = useCallback(async () => {
    const data = await api.me();
    applySession(data.user, data.traveller);
    return data;
  }, [applySession]);

  const signup = useCallback(
    async (email, password) => {
      const data = await api.signup({ email, password });
      setAccessToken(data.accessToken);
      await hydrate();
      return data;
    },
    [hydrate],
  );

  const login = useCallback(
    async (email, password) => {
      const data = await api.login({ email, password });
      setAccessToken(data.accessToken);
      await hydrate();
      return data;
    },
    [hydrate],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clearAccessToken();
    applySession(null, null);
  }, [applySession]);

  const saveProfile = useCallback(async (profile) => {
    const data = await api.putMyProfile(profile);
    setTraveller(data.traveller);
    return data.traveller;
  }, []);

  const value = {
    status,
    user,
    traveller,
    hasProfile: !!traveller,
    signup,
    login,
    logout,
    saveProfile,
    hydrate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
