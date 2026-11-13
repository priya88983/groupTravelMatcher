import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken, clearAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [traveller, setTraveller] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated

  const applySession = useCallback((nextUser, nextTraveller) => {
    console.log('[Auth] Applying session:', { nextUser, nextTraveller });

    setUser(nextUser || null);
    setTraveller(nextTraveller ?? null);
    setStatus(nextUser ? 'authenticated' : 'unauthenticated');

    console.log('[Auth] Session status:', nextUser ? 'authenticated' : 'unauthenticated');
  }, []);

  // Silent session restore: try the refresh endpoint once on application load.
  useEffect(() => {
    console.log('[Auth] Initializing session restore...');

    let cancelled = false;
    (async () => {
      try {
        console.log('[Auth] Calling refresh API...');
        const { accessToken, user: sessionUser } = await api.refresh();

        console.log('[Auth] Refresh successful:', { sessionUser, hasAccessToken: !!accessToken });

        if (cancelled) return;

        setAccessToken(accessToken);
        setUser(sessionUser);
        setStatus('authenticated');

        console.log('[Auth] Fetching user profile...');
        try {
          const data = await api.me();
          console.log('[Auth] User profile fetched:', data);

          if (!cancelled) setTraveller(data.traveller ?? null);
        } catch (error) {
          console.error('[Auth] Failed to fetch user profile:', error);
          if (!cancelled) setTraveller(null);
        }
      } catch (error) {
        console.error('[Auth] Session restore failed:', error);

        if (!cancelled) {
          clearAccessToken();
          applySession(null, null);
        }
      } finally {
        if (!cancelled) {
          setStatus((current) => (current === 'loading' ? 'unauthenticated' : current));
          console.log('[Auth] Session restore completed.');
        }
      }
    })();

    return () => {
      console.log('[Auth] Cleanup: cancelling session restore.');
      cancelled = true;
    };
  }, [applySession]);

  const hydrate = useCallback(async () => {
    console.log('[Auth] Hydrating user session...');

    const data = await api.me();

    console.log('[Auth] Hydration successful:', data);

    applySession(data.user, data.traveller);
    return data;
  }, [applySession]);

  const signup = useCallback(
    async (email, password) => {
      console.log('[Auth] Signup initiated:', { email });

      const data = await api.signup({ email, password });

      console.log('[Auth] Signup successful.');

      setAccessToken(data.accessToken);
      await hydrate();

      console.log('[Auth] Signup session hydrated.');

      return data;
    },
    [hydrate],
  );

  const login = useCallback(
    async (email, password) => {
      console.log('[Auth] Login initiated:', { email });

      const data = await api.login({ email, password });

      console.log('[Auth] Login successful.');

      setAccessToken(data.accessToken);
      await hydrate();

      console.log('[Auth] Login session hydrated.');

      return data;
    },
    [hydrate],
  );

  const logout = useCallback(async () => {
    console.log('[Auth] Logout initiated.');

    try {
      await api.logout();
      console.log('[Auth] Logout API successful.');
    } catch (error) {
      console.error('[Auth] Logout API failed:', error);
      /* ignore network errors on logout */
    }

    clearAccessToken();
    applySession(null, null);

    console.log('[Auth] User logged out successfully.');
  }, [applySession]);

  const saveProfile = useCallback(async (profile) => {
    console.log('[Auth] Saving traveller profile:', profile);

    const data = await api.putMyProfile(profile);

    console.log('[Auth] Profile saved successfully:', data.traveller);

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

  console.log('[Auth] Current context state:', {
    status,
    user,
    traveller,
    hasProfile: !!traveller,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  console.log('[Auth] useAuth called:', context);
  return context;
}