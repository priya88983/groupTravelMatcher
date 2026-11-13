import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import crypto from 'node:crypto';

// Use a unique, isolated DB per test run so counts are deterministic.
const testDbName = `group-travel-test-${Date.now()}.db`;
process.env.SQLITE_DB_PATH = `./database/${testDbName}`;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const { default: app } = await import('../src/app.js');
const db = (await import('../src/config/database.js')).default;
const { migrate } = await import('../src/config/migrate.js');
const { seedAll, demoEmailFor } = await import('../src/services/seedService.js');
const { signAccessToken, verifyAccessToken } = await import('../src/utils/tokens.js');

let server;
let BASE;
const cookies = {};

function parseCookieHeader() {
  const value = server && server._lastSetCookie;
  return value || null;
}

function cookieFromResponse(res) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  const first = raw.split(';')[0];
  const eq = first.indexOf('=');
  return { name: first.slice(0, eq), value: first.slice(eq + 1) };
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookies.refresh_token) headers.cookie = `refresh_token=${cookies.refresh_token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const setCookie = cookieFromResponse(res);
  if (setCookie) {
    cookies[setCookie.name] = setCookie.value;
  }

  let data = null;
  if (res.status !== 204) {
    data = await res.json().catch(() => null);
  }
  return { status: res.status, data, res };
}

before(async () => {
  migrate();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      BASE = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

beforeEach(() => {
  for (const key of Object.keys(cookies)) delete cookies[key];
});

const validSignup = {
  email: 'alice.preview@example.com',
  password: 'Hackathon!2026',
};

const validProfile = {
  name: 'Alice Preview',
  age: 27,
  gender: 'FEMALE',
  home_city: 'Bengaluru',
  home_airport: 'BLR',
  gender_preference: 'SAME_GENDER',
  interests: ['TEMPLES', 'STREET_FOOD'],
};

describe('authentication', () => {
  it('signs up, returns tokens and does not leak secrets', async () => {
    const { status, data } = await request('/api/auth/signup', {
      method: 'POST',
      body: validSignup,
    });
    assert.equal(status, 201);
    assert.ok(data.accessToken);
    assert.equal(data.user.email, validSignup.email);
    assert.equal(data.user.password, undefined);
    assert.equal(data.user.password_hash, undefined);
    assert.equal(data.user.refresh, undefined);

    const stored = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(validSignup.email);
    assert.ok(stored.password_hash);
    assert.notEqual(stored.password_hash, validSignup.password);
  });

  it('rejects duplicate email', async () => {
    const { status, data } = await request('/api/auth/signup', {
      method: 'POST',
      body: validSignup,
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'EMAIL_IN_USE');
  });

  it('rejects weak password', async () => {
    const { status } = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: 'weak@example.com', password: 'short' },
    });
    assert.equal(status, 400);
  });

  it('logs in with correct credentials', async () => {
    const { status, data } = await request('/api/auth/login', {
      method: 'POST',
      body: validSignup,
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);
    assert.equal(data.user.email, validSignup.email);
  });

  it('rejects incorrect password', async () => {
    const { status, data } = await request('/api/auth/login', {
      method: 'POST',
      body: { email: validSignup.email, password: 'wrong-password-123' },
    });
    assert.equal(status, 401);
    assert.equal(data.error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects unknown email', async () => {
    const { status } = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'whatever-12345' },
    });
    assert.equal(status, 401);
  });
});

describe('token management', () => {
  it('access token verifies and expires', async () => {
    const token = signAccessToken(1);
    assert.equal(verifyAccessToken(token), 1);

    const { default: jwt } = await import('jsonwebtoken');
    const shortLived = jwt.sign(
      { sub: '1', type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1s' },
    );
    assert.equal(verifyAccessToken(shortLived), 1);
    await new Promise((r) => setTimeout(r, 1150));
    assert.equal(verifyAccessToken(shortLived), null);
  });

  it('refresh endpoint rotates the refresh token', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const firstRefresh = cookies.refresh_token;
    assert.ok(firstRefresh);

    const response = await request('/api/auth/refresh', { method: 'POST' });
    assert.equal(response.status, 200);
    assert.ok(response.data.accessToken);
    assert.ok(cookies.refresh_token);
    assert.notEqual(cookies.refresh_token, firstRefresh);
  });

  it('rejects reuse of an already-rotated refresh token and revokes the family', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const firstRefresh = cookies.refresh_token;

    // First rotation: consumes firstRefresh.
    await request('/api/auth/refresh', { method: 'POST' });
    const secondRefresh = cookies.refresh_token;

    // Reuse the old token: should be rejected and revoke the family.
    cookies.refresh_token = firstRefresh;
    const reuse = await request('/api/auth/refresh', { method: 'POST' });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.data.error.code, 'REFRESH_TOKEN_REUSED');

    // The new token is now in a revoked family and must also be rejected.
    cookies.refresh_token = secondRefresh;
    const afterReuse = await request('/api/auth/refresh', { method: 'POST' });
    assert.equal(afterReuse.status, 401);
  });

  it('logout revokes the refresh session', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const logout = await request('/api/auth/logout', { method: 'POST' });
    assert.equal(logout.status, 204);

    const refresh = await request('/api/auth/refresh', { method: 'POST' });
    assert.equal(refresh.status, 401);
  });

  it('protected route rejects missing/invalid token', async () => {
    const missing = await request('/api/travellers/me');
    assert.equal(missing.status, 401);

    const invalid = await request('/api/travellers/me', { token: 'not-a-token' });
    assert.equal(invalid.status, 401);
  });

  it('/api/auth/me returns user and profile state', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const { status, data } = await request('/api/auth/me', {
      token: (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken,
    });
    assert.equal(status, 200);
    assert.equal(data.user.email, validSignup.email);
    assert.ok('traveller' in data);
  });
});

describe('traveller profiles', () => {
  it('returns 404 before a profile exists', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const { status } = await request('/api/travellers/me', {
      token: (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken,
    });
    assert.equal(status, 404);
  });

  it('creates a profile and does not expose user_id', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const accessToken = (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken;

    const { status, data } = await request('/api/travellers/me', {
      method: 'PUT',
      token: accessToken,
      body: validProfile,
    });
    assert.equal(status, 201);
    assert.equal(data.traveller.name, validProfile.name);
    assert.equal(data.traveller.email, undefined);
    assert.equal(data.traveller.password, undefined);
    assert.equal(data.traveller.user_id, undefined);
    assert.deepEqual(data.traveller.interests, validProfile.interests);
    assert.match(data.traveller.traveller_id, /^T-[0-9a-f]{6}$/);
  });

  it('rejects invalid profile fields', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const accessToken = (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken;

    const { status } = await request('/api/travellers/me', {
      method: 'PUT',
      token: accessToken,
      body: { ...validProfile, age: 15 },
    });
    assert.equal(status, 400);

    const badInterest = await request('/api/travellers/me', {
      method: 'PUT',
      token: accessToken,
      body: { ...validProfile, interests: ['NOT_A_REAL_INTEREST'] },
    });
    assert.equal(badInterest.status, 400);
  });

  it('updates the existing profile in place', async () => {
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const accessToken = (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken;

    await request('/api/travellers/me', {
      method: 'PUT',
      token: accessToken,
      body: { ...validProfile, interests: ['TEMPLES', 'STREET_FOOD'] },
    });
    const update = await request('/api/travellers/me', {
      method: 'PUT',
      token: accessToken,
      body: { ...validProfile, age: 28, interests: ['BEACHES', 'NATURE'] },
    });
    assert.equal(update.status, 201);
    assert.equal(update.data.traveller.age, 28);
    assert.deepEqual(update.data.traveller.interests, ['BEACHES', 'NATURE']);
  });

  it('does not let one user modify another traveller profile', async () => {
    const otherEmail = 'bob.preview@example.com';
    await request('/api/auth/signup', {
      method: 'POST',
      body: { email: otherEmail, password: 'Hackathon!2026' },
    });
    await request('/api/auth/login', { method: 'POST', body: { email: otherEmail, password: 'Hackathon!2026' } });
    const bobToken = (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken;

    await request('/api/travellers/me', {
      method: 'PUT',
      token: bobToken,
      body: { ...validProfile, name: 'Bob Preview', interests: ['HIKING'] },
    });

    // Alice still owns her own profile data.
    await request('/api/auth/login', { method: 'POST', body: validSignup });
    const aliceToken = (await request('/api/auth/refresh', { method: 'POST' })).data.accessToken;
    const alice = await request('/api/travellers/me', { token: aliceToken });
    assert.equal(alice.status, 200);
    assert.equal(alice.data.traveller.name, 'Alice Preview');
    assert.deepEqual(alice.data.traveller.interests, ['BEACHES', 'NATURE']);
  });
});

describe('meta', () => {
  it('returns valid interests from the catalog', async () => {
    const { status, data } = await request('/api/meta/interests');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.interests) && data.interests.length > 0);
    assert.ok(data.interests.some((i) => i.interest === 'TEMPLES'));
  });
});

describe('seeding', () => {
  const seedPassword = 'Demo-Seed-Password!2';

  it('seeds 24 travellers preserving original IDs and 12 groups', async () => {
    const first = await seedAll(seedPassword);
    assert.equal(first.travellers.createdUsers, 24);
    assert.equal(first.travellers.existingUsers, 0);

    const ids = db
      .prepare('SELECT traveller_id FROM travellers')
      .all()
      .map((r) => r.traveller_id)
      .filter((id) => /^T-\d{3}$/.test(id))
      .sort();
    assert.equal(ids.length, 24);
    assert.equal(ids[0], 'T-001');
    assert.equal(ids[23], 'T-024');

    // Demo email pattern exists and account links to the original traveller id.
    const email = demoEmailFor('Sarah Thomas');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    assert.ok(user);
    const linked = db.prepare('SELECT traveller_id FROM travellers WHERE user_id = ?').get(user.id);
    assert.equal(linked.traveller_id, 'T-001');

    assert.equal(first.groups.groups, 12);
    assert.ok(first.groups.members >= 12);

    // Owner/member relationships reference existing travellers.
    const orphanMembers = db.prepare(`
      SELECT COUNT(*) AS n FROM group_members gm
      LEFT JOIN travellers t ON t.traveller_id = gm.traveller_id
      WHERE t.traveller_id IS NULL
    `).get();
    assert.equal(orphanMembers.n, 0);
  });

  it('re-seeding does not duplicate or overwrite', async () => {
    const second = await seedAll(seedPassword);
    assert.equal(second.travellers.createdUsers, 0);
    assert.equal(second.travellers.existingUsers, 24);
    assert.equal(second.groups.groups, 12);

    // Original seeded profile untouched.
    const email = demoEmailFor('Sarah Thomas');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    const profile = db.prepare('SELECT name FROM travellers WHERE user_id = ?').get(user.id);
    assert.equal(profile.name, 'Sarah Thomas');
  });
});

describe('persistence', () => {
  it('data survives a backend restart', async () => {
    const email = validSignup.email;
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        BASE = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    const { status, data } = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: validSignup.password },
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);

    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    assert.ok(count >= 26, `expected at least signup+seed users, got ${count}`);
  });
});
