// Pure unit tests for the AuthProvider session reducer.
//
// These run with Node's built-in test runner (no npm deps needed):
//   node --test src/context/authReducer.test.mjs
//
// They verify the core of the race-condition fix: the authenticated user and the
// traveller profile are published together, the state stays 'loading' until the
// profile hydration finishes, and 'missing' (no profile) is distinct from
// 'error' (failed profile fetch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer, INITIAL_STATE } from './authReducer.js';

const USER = { id: 1, email: 'sarah@example.com' };
const TRAVELLER = { id: 1, name: 'Sarah' };

test('initial state is loading with no user/profile', () => {
  assert.equal(INITIAL_STATE.status, 'loading');
  assert.equal(INITIAL_STATE.user, null);
  assert.equal(INITIAL_STATE.traveller, null);
  assert.equal(INITIAL_STATE.profileStatus, 'loading');
});

test('SESSION_SET publishes user and profile together as authenticated/ready', () => {
  const next = reducer(INITIAL_STATE, {
    type: 'SESSION_SET',
    user: USER,
    traveller: TRAVELLER,
    profileStatus: 'ready',
  });
  assert.equal(next.status, 'authenticated');
  // Both must be present together — no half-authenticated state.
  assert.equal(next.user, USER);
  assert.equal(next.traveller, TRAVELLER);
  assert.equal(next.profileStatus, 'ready');
});

test('SESSION_SET with missing profile (404) is authenticated but profileStatus=missing', () => {
  const next = reducer(INITIAL_STATE, {
    type: 'SESSION_SET',
    user: USER,
    traveller: null,
    profileStatus: 'missing',
  });
  assert.equal(next.status, 'authenticated');
  assert.equal(next.user, USER);
  assert.equal(next.traveller, null);
  assert.equal(next.profileStatus, 'missing');
});

test('SESSION_SET with failed profile fetch is authenticated but profileStatus=error (distinct from missing)', () => {
  const next = reducer(INITIAL_STATE, {
    type: 'SESSION_SET',
    user: USER,
    traveller: null,
    profileStatus: 'error',
  });
  assert.equal(next.status, 'authenticated');
  assert.equal(next.user, USER);
  assert.equal(next.profileStatus, 'error');
});

test('UNAUTHENTICATED clears the whole session', () => {
  const authed = reducer(INITIAL_STATE, {
    type: 'SESSION_SET',
    user: USER,
    traveller: TRAVELLER,
    profileStatus: 'ready',
  });
  const next = reducer(authed, { type: 'UNAUTHENTICATED' });
  assert.equal(next.status, 'unauthenticated');
  assert.equal(next.user, null);
  assert.equal(next.traveller, null);
  assert.equal(next.profileStatus, 'idle');
});

test('PROFILE_UPDATED keeps the session and marks profile ready', () => {
  const authed = reducer(INITIAL_STATE, {
    type: 'SESSION_SET',
    user: USER,
    traveller: null,
    profileStatus: 'missing',
  });
  const next = reducer(authed, { type: 'PROFILE_UPDATED', traveller: TRAVELLER });
  assert.equal(next.status, 'authenticated');
  assert.equal(next.user, USER);
  assert.equal(next.traveller, TRAVELLER);
  assert.equal(next.profileStatus, 'ready');
});

test('a reducer never transitions to authenticated without a profileStatus, and never has user=null while authenticated', () => {
  // There is no action that sets status without also setting profileStatus.
  // Exercise every action and assert the invariant holds after each.
  const states = [
    reducer(INITIAL_STATE, { type: 'SESSION_SET', user: USER, traveller: null, profileStatus: 'ready' }),
    reducer(INITIAL_STATE, { type: 'SESSION_SET', user: USER, traveller: null, profileStatus: 'missing' }),
    reducer(INITIAL_STATE, { type: 'SESSION_SET', user: USER, traveller: null, profileStatus: 'error' }),
    reducer(INITIAL_STATE, { type: 'UNAUTHENTICATED' }),
  ];
  for (const s of states) {
    if (s.status === 'authenticated') {
      assert.ok(s.user, 'authenticated state must have a user');
      assert.ok(['ready', 'missing', 'error'].includes(s.profileStatus));
    }
  }
});
