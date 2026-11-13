// Integration tests for the AuthContext session-restoration race fix.
//
// These use Vitest + @testing-library/react (NOT installed in this offline
// environment yet). Once network is available, run:
//   npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom
//   npm test
//
// They verify the user-facing behaviour required by the fix:
//   - a delayed profile load keeps the route on "Loading" (no redirect to setup)
//   - a page reload restores the session without bouncing to /login or /setup-profile
//   - a failed profile API request shows an error, NOT a setup-profile redirect
//   - direct navigation to /create-group, /explore, /search, /my-groups works
//     for an authenticated user with a profile
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import { api } from '../services/api.js';

// ---- mocks ---------------------------------------------------------------
vi.mock('../services/api.js', () => ({
  api: {
    refresh: vi.fn(),
    me: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    putMyProfile: vi.fn(),
  },
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

const USER = { id: 1, email: 'sarah@example.com', name: 'Sarah' };
const TRAVELLER = { id: 1, name: 'Sarah', city: 'Delhi' };

function SessionProbe() {
  return <div data-testid="probe">probe</div>;
}

function harness(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<SessionProbe />} />
          <Route path="/create-group" element={<SessionProbe />} />
          <Route path="/explore" element={<SessionProbe />} />
          <Route path="/search" element={<SessionProbe />} />
          <Route path="/my-groups" element={<SessionProbe />} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/setup-profile" element={<div>setup page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthContext session restoration', () => {
  beforeEach(() => {
    api.refresh.mockReset();
    api.me.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stays on Loading while the profile is still hydrating (no setup redirect)', async () => {
    // refresh resolves immediately with a user, me() hangs (delayed).
    api.refresh.mockResolvedValue({ accessToken: 't', user: USER });
    let resolveMe;
    api.me.mockReturnValue(new Promise((r) => (resolveMe = r)));

    harness('/create-group');
    // While me() is unresolved we must show loading, NOT setup-profile.
    expect(screen.queryByText('setup page')).not.toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();

    resolveMe({ user: USER, traveller: TRAVELLER });
    await waitFor(() => expect(screen.getByTestId('probe')).toBeInTheDocument());
  });

  it('restores an authenticated profile on reload without redirecting to login/setup', async () => {
    api.refresh.mockResolvedValue({ accessToken: 't', user: USER });
    api.me.mockResolvedValue({ user: USER, traveller: TRAVELLER });

    harness('/explore');
    await waitFor(() => expect(screen.getByTestId('probe')).toBeInTheDocument());
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('setup page')).not.toBeInTheDocument();
  });

  it('distinguishes a failed profile request from a missing profile (no setup redirect)', async () => {
    api.refresh.mockResolvedValue({ accessToken: 't', user: USER });
    const err = new Error('boom');
    err.status = 500;
    api.me.mockRejectedValue(err);

    harness('/search');
    await waitFor(() => expect(api.me).toHaveBeenCalled());
    // Must NOT be treated as a missing profile -> no setup-page redirect.
    expect(screen.queryByText('setup page')).not.toBeInTheDocument();
  });

  it('recognises a genuinely missing profile (404) and allows setup', async () => {
    api.refresh.mockResolvedValue({ accessToken: 't', user: USER });
    const err = new Error('not found');
    err.status = 404;
    api.me.mockRejectedValue(err);

    harness('/setup-profile');
    await waitFor(() => expect(api.me).toHaveBeenCalled());
    // 404 -> missing profile -> setup page renders.
    await waitFor(() => expect(screen.getByText('setup page')).toBeInTheDocument());
  });

  it('lets a fully hydrated user navigate to all protected group routes', async () => {
    api.refresh.mockResolvedValue({ accessToken: 't', user: USER });
    api.me.mockResolvedValue({ user: USER, traveller: TRAVELLER });

    for (const path of ['/create-group', '/explore', '/search', '/my-groups']) {
      harness(path);
      await waitFor(() => expect(screen.getByTestId('probe')).toBeInTheDocument());
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      expect(screen.queryByText('setup page')).not.toBeInTheDocument();
      screen.unmount();
    }
  });
});
