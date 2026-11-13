// Pure session reducer for AuthProvider.
//
// The authenticated user and their traveller profile are ALWAYS published as a
// single atomic state value (SESSION_SET), so the UI never observes a
// half-authenticated state (status='authenticated' but profile still loading).
//
// status:        'loading' | 'authenticated' | 'unauthenticated'
// profileStatus: 'loading' | 'ready' | 'missing' | 'error'
//   - 'ready'   profile fetched and present
//   - 'missing' user authenticated but has NO profile (404 -> setup-profile)
//   - 'error'   profile fetch failed (network/5xx) — distinct from "missing"
export const INITIAL_STATE = {
  status: 'loading',
  user: null,
  traveller: null,
  profileStatus: 'loading',
};

export function reducer(state, action) {
  switch (action.type) {
    // Publish the session as a single atomic value.
    case 'SESSION_SET':
      return {
        status: 'authenticated',
        user: action.user,
        traveller: action.traveller ?? null,
        profileStatus: action.profileStatus,
      };
    case 'UNAUTHENTICATED':
      return { status: 'unauthenticated', user: null, traveller: null, profileStatus: 'idle' };
    case 'PROFILE_UPDATED':
      return { ...state, traveller: action.traveller, profileStatus: 'ready' };
    default:
      return state;
  }
}
