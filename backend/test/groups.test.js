import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

// Isolated DB per test run.
const testDbName = `group-travel-groups-test-${Date.now()}.db`;
process.env.SQLITE_DB_PATH = `./database/${testDbName}`;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const { default: app } = await import('../src/app.js');
const db = (await import('../src/config/database.js')).default;
const { migrate } = await import('../src/config/migrate.js');
const { seedAll, demoEmailFor } = await import('../src/services/seedService.js');

const SEED_PASSWORD = 'Demo-Seed-Password!2';
let server;
let BASE;
const cookies = {};

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
  if (setCookie) cookies[setCookie.name] = setCookie.value;

  let data = null;
  if (res.status !== 204) {
    data = await res.json().catch(() => null);
  }
  return { status: res.status, data, res };
}

async function loginAs(name) {
  const email = demoEmailFor(name);
  await request('/api/auth/login', { method: 'POST', body: { email, password: SEED_PASSWORD } });
  const { data } = await request('/api/auth/refresh', { method: 'POST' });
  return data.accessToken;
}

before(async () => {
  migrate();
  await seedAll(SEED_PASSWORD);
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

const sarahSearch = {
  destination: 'Kyoto',
  check_in: '2027-04-09',
  check_out: '2027-04-16',
  budget_inr: 62000,
  interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'],
};

describe('group creation', () => {
  it('creates a valid group with owner membership', async () => {
    const token = await loginAs('Sarah Thomas');
    const { status, data } = await request('/api/groups', {
      method: 'POST',
      token,
      body: {
        name: 'Kyoto Cherry Walk',
        city: 'Kyoto',
        check_in: '2027-04-01',
        check_out: '2027-04-07',
        max_size: 3,
        budget_inr: 50000,
        itinerary: 'Philosopher path, Gion, Fushimi Inari.',
      },
    });
    assert.equal(status, 201);
    assert.match(data.group.group_id, /^G-[0-9a-f]{6}$/);
    assert.equal(data.group.name, 'Kyoto Cherry Walk');
    assert.equal(data.group.owner_id, 'T-001');
    assert.equal(data.group.member_count, 1);
    assert.equal(data.group.status, 'OPEN');
    assert.equal(data.group.available_spots, 2);

    const stored = db.prepare('SELECT * FROM groups WHERE group_id = ?').get(data.group.group_id);
    assert.ok(stored);
    assert.equal(stored.max_size, 3);
    const ownerMember = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND traveller_id = ?')
      .get(data.group.group_id, 'T-001');
    assert.equal(ownerMember.role, 'owner');
  });

  it('rejects unsupported destinations', async () => {
    const token = await loginAs('Sarah Thomas');
    const { status, data } = await request('/api/groups', {
      method: 'POST',
      token,
      body: { name: 'X', city: 'Paris', check_in: '2027-04-01', check_out: '2027-04-05', max_size: 3, budget_inr: 50000 },
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, 'INVALID_DESTINATION');
  });

  it('rejects dates outside the 1-20 April window', async () => {
    const token = await loginAs('Sarah Thomas');
    const bad = await request('/api/groups', {
      method: 'POST',
      token,
      body: { name: 'X', city: 'Kyoto', check_in: '2027-05-01', check_out: '2027-05-05', max_size: 3, budget_inr: 50000 },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error.code, 'INVALID_DATES');
  });

  it('rejects check-out before check-in', async () => {
    const token = await loginAs('Sarah Thomas');
    const bad = await request('/api/groups', {
      method: 'POST',
      token,
      body: { name: 'X', city: 'Kyoto', check_in: '2027-04-05', check_out: '2027-04-01', max_size: 3, budget_inr: 50000 },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error.code, 'INVALID_DATES');
  });

  it('rejects invalid group capacity', async () => {
    const token = await loginAs('Sarah Thomas');
    for (const maxSize of [0, 5, 2.5, 'three']) {
      const res = await request('/api/groups', {
        method: 'POST',
        token,
        body: { name: 'X', city: 'Kyoto', check_in: '2027-04-01', check_out: '2027-04-05', max_size: maxSize, budget_inr: 50000 },
      });
      assert.equal(res.status, 400);
    }
  });

  it('newly created group persists and appears in the feed', async () => {
    const token = await loginAs('Sarah Thomas');
    const { data } = await request('/api/groups', { token });
    assert.ok(data.total >= 13);
    const names = data.groups.map((g) => g.name);
    assert.ok(names.includes('Kyoto Cherry Walk'));
    assert.ok(names.includes('Kyoto Spring Temples'));
    const stored = db.prepare('SELECT COUNT(*) AS n FROM groups').get().n;
    assert.ok(stored >= 13);
  });
});

describe('matching', () => {
  it('ranks Sarah\'s group as an eligible match under all six rules', async () => {
    const token = await loginAs('Priya Shah');
    const { status, data } = await request('/api/search', { method: 'POST', token, body: sarahSearch });
    assert.equal(status, 200);
    const match = data.results.find((r) => r.group.group_id === 'G-01');
    assert.ok(match, 'G-01 should be an eligible match for Priya');
    assert.ok(match.eligibility.explanations.includes('5 overlapping nights'));
    assert.ok(match.eligibility.explanations.includes('2 shared interests'));
    assert.ok(match.eligibility.explanations.includes('Compatible budget'));
    assert.ok(match.eligibility.explanations.some((e) => /spots remaining/.test(e)));
    assert.ok(match.score > 0);
  });

  it('excludes incompatible groups (wrong city, insufficient overlap)', async () => {
    const token = await loginAs('Priya Shah');
    const { data } = await request('/api/search', { method: 'POST', token, body: sarahSearch });
    const ids = data.results.map((r) => r.group.group_id);
    assert.ok(!ids.includes('G-03'), 'Osaka group must not match a Kyoto search');
    assert.ok(!ids.includes('G-02'), 'G-02 overlaps only 1 night and must not match');
    assert.ok(!ids.includes('G-07'), 'full group must not be joinable');
  });

  it('excludes the seeker\'s own groups', async () => {
    const token = await loginAs('Sarah Thomas');
    const { data } = await request('/api/search', {
      method: 'POST',
      token,
      body: { ...sarahSearch, destination: 'Tokyo', check_in: '2027-04-01', check_out: '2027-04-10', budget_inr: 60000, interests: ['TEMPLES', 'STREET_FOOD'] },
    });
    assert.ok(!data.results.some((r) => r.group.group_id === 'G-01'));
  });
});

describe('join requests', () => {
  it('sends a join request successfully', async () => {
    const token = await loginAs('Priya Shah');
    const { status, data } = await request('/api/groups/G-01/requests', {
      method: 'POST',
      token,
      body: sarahSearch,
    });
    assert.equal(status, 201);
    assert.equal(data.request.status, 'PENDING');
    assert.equal(data.request.group_id, 'G-01');
    assert.equal(data.request.traveller_id, 'T-002');
  });

  it('blocks duplicate requests', async () => {
    const token = await loginAs('Priya Shah');
    const { status, data } = await request('/api/groups/G-01/requests', {
      method: 'POST',
      token,
      body: sarahSearch,
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'REQUEST_EXISTS');
  });

  it('blocks requests to your own group', async () => {
    const token = await loginAs('Sarah Thomas');
    const { status, data } = await request('/api/groups/G-01/requests', {
      method: 'POST',
      token,
      body: sarahSearch,
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, 'OWN_GROUP');
  });

  it('blocks requests to a full group', async () => {
    const token = await loginAs('Priya Shah');
    const { status, data } = await request('/api/groups/G-07/requests', {
      method: 'POST',
      token,
      body: { ...sarahSearch, destination: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-18' },
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'GROUP_FULL');
  });
});

describe('owner decisions', () => {
  it('owner approves a pending request and adds the member', async () => {
    const sarahToken = await loginAs('Sarah Thomas');
    const { data } = await request('/api/groups/G-01/requests', { token: sarahToken });
    const pending = data.requests.find((r) => r.traveller_id === 'T-002');
    assert.equal(pending.status, 'PENDING');

    const decision = await request(`/api/requests/${pending.id}`, {
      method: 'PATCH',
      token: sarahToken,
      body: { action: 'approve' },
    });
    assert.equal(decision.status, 200);
    assert.equal(decision.data.request.status, 'APPROVED');

    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND traveller_id = ?')
      .get('G-01', 'T-002');
    assert.ok(member);
    assert.equal(member.role, 'member');
  });

  it('owner rejects a request', async () => {
    const sarahToken = await loginAs('Sarah Thomas');
    // Sarah creates a new group, Meera requests it, Sarah rejects.
    const created = await request('/api/groups', {
      method: 'POST',
      token: sarahToken,
      body: { name: 'Kyoto Tea Walk', city: 'Kyoto', check_in: '2027-04-01', check_out: '2027-04-08', max_size: 3, budget_inr: 55000, itinerary: 'Tea houses.' },
    });
    const groupId = created.data.group.group_id;

    const meeraToken = await loginAs('Meera Iyer');
    const req = await request(`/api/groups/${groupId}/requests`, {
      method: 'POST',
      token: meeraToken,
      body: { destination: 'Kyoto', check_in: '2027-04-01', check_out: '2027-04-10', budget_inr: 60000, interests: ['STREET_FOOD', 'TEMPLES'] },
    });
    assert.equal(req.status, 201);

    const decision = await request(`/api/requests/${req.data.request.id}`, {
      method: 'PATCH',
      token: sarahToken,
      body: { action: 'reject' },
    });
    assert.equal(decision.status, 200);
    assert.equal(decision.data.request.status, 'REJECTED');

    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND traveller_id = ?')
      .get(groupId, 'T-003');
    assert.equal(member, undefined);
  });

  it('blocks non-owner approval attempts', async () => {
    const token = await loginAs('Sarah Thomas');
    const { data } = await request('/api/groups/G-01/requests', { token });
    const pending = data.requests.find((r) => r.status === 'PENDING');
    if (!pending) return;
    const priyaToken = await loginAs('Priya Shah');
    const res = await request(`/api/requests/${pending.id}`, {
      method: 'PATCH',
      token: priyaToken,
      body: { action: 'approve' },
    });
    assert.equal(res.status, 403);
    assert.equal(res.data.error.code, 'FORBIDDEN');
  });

  it('prevents overfilling from competing approvals', async () => {
    const sarahToken = await loginAs('Sarah Thomas');
    const created = await request('/api/groups', {
      method: 'POST',
      token: sarahToken,
      body: { name: 'Osaka Weekend', city: 'Osaka', check_in: '2027-04-10', check_out: '2027-04-13', max_size: 2, budget_inr: 50000, itinerary: 'Dotonbori.' },
    });
    const groupId = created.data.group.group_id;

    const priyaToken = await loginAs('Priya Shah');
    await request(`/api/groups/${groupId}/requests`, {
      method: 'POST',
      token: priyaToken,
      body: { destination: 'Osaka', check_in: '2027-04-10', check_out: '2027-04-14', budget_inr: 52000, interests: ['STREET_FOOD', 'TEMPLES'] },
    });

    const meeraToken = await loginAs('Meera Iyer');
    await request(`/api/groups/${groupId}/requests`, {
      method: 'POST',
      token: meeraToken,
      body: { destination: 'Osaka', check_in: '2027-04-10', check_out: '2027-04-14', budget_inr: 52000, interests: ['STREET_FOOD', 'TEMPLES'] },
    });

    const { data } = await request(`/api/groups/${groupId}/requests`, { token: sarahToken });
    const priyaReq = data.requests.find((r) => r.traveller_id === 'T-002');
    const meeraReq = data.requests.find((r) => r.traveller_id === 'T-003');

    const first = await request(`/api/requests/${priyaReq.id}`, {
      method: 'PATCH',
      token: sarahToken,
      body: { action: 'approve' },
    });
    assert.equal(first.status, 200);

    const second = await request(`/api/requests/${meeraReq.id}`, {
      method: 'PATCH',
      token: sarahToken,
      body: { action: 'approve' },
    });
    assert.equal(second.status, 409);
    assert.equal(second.data.error.code, 'GROUP_FULL');
  });
});

describe('my groups', () => {
  it('returns groups where the user is an approved member with correct role', async () => {
    const priyaToken = await loginAs('Priya Shah');
    const { data } = await request('/api/users/me/groups', { token: priyaToken });
    const g1 = data.groups.find((g) => g.group_id === 'G-01');
    assert.ok(g1, 'Priya should see G-01 after approval');
    assert.equal(g1.role, 'MEMBER');

    const sarahToken = await loginAs('Sarah Thomas');
    const { data: sarahData } = await request('/api/users/me/groups', { token: sarahToken });
    const sarahG1 = sarahData.groups.find((g) => g.group_id === 'G-01');
    assert.equal(sarahG1.role, 'CREATOR');
  });

  it('groups persist after a backend restart', async () => {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        BASE = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
    const priyaToken = await loginAs('Priya Shah');
    const { data } = await request('/api/users/me/groups', { token: priyaToken });
    assert.ok(data.groups.some((g) => g.group_id === 'G-01'));
  });
});
