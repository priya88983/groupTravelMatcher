import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { api, setAccessToken, clearAccessToken } from '../services/api.js';
import { INITIAL_STATE, reducer } from './authReducer.js';

const AuthContext = createContext(null);

// Session state shape and reducer live in authReducer.js so they can be unit
// tested without a DOM. See that module for the status/profileStatus contract.

export function AuthProvider({ children }) {
  const [session, dispatch] = useReducer(reducer, INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Silent session restore. Runs once on application load. The session stays in
  // 'loading' until BOTH the JWT refresh AND the profile hydration complete;
  // only then do we publish the user + profile together. This means route
  // guards never see an authenticated-but-profileless intermediate state.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { accessToken, user: sessionUser } = await api.refresh();
        if (cancelled) return;
        setAccessToken(accessToken);

        let data;
        try {
          data = await api.me();
        } catch (error) {
          if (cancelled) return;
          if (error.status === 404) {
            // Authenticated but no profile exists yet -> setup-profile is correct.
            dispatch({
              type: 'SESSION_SET',
              user: sessionUser,
              traveller: null,
              profileStatus: 'missing',
            });
          } else {
            // Real profile API failure (network/5xx). Keep the valid session but
            // mark the profile as errored — do NOT claim a missing profile.
            dispatch({
              type: 'SESSION_SET',
              user: sessionUser,
              traveller: null,
              profileStatus: 'error',
            });
          }
          return;
        }

        if (!cancelled) {
          dispatch({
            type: 'SESSION_SET',
            user: sessionUser,
            traveller: data?.traveller ?? null,
            profileStatus: data?.traveller ? 'ready' : 'missing',
          });
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          dispatch({ type: 'UNAUTHENTICATED' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hydrate = useCallback(async () => {
    const data = await api.me();
    dispatch({
      type: 'SESSION_SET',
      user: data.user,
      traveller: data.traveller ?? null,
      profileStatus: data.traveller ? 'ready' : 'missing',
    });
    return data;
  }, []);

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
    dispatch({ type: 'UNAUTHENTICATED' });
  }, []);

  const saveProfile = useCallback(async (profile) => {
    const data = await api.putMyProfile(profile);
    dispatch({ type: 'PROFILE_UPDATED', traveller: data.traveller });
    return data.traveller;
  }, []);

  const value = {
    status: session.status,
    user: session.user,
    traveller: session.traveller,
    profileStatus: session.profileStatus,
    hasProfile: session.profileStatus === 'ready' && !!session.traveller,
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
