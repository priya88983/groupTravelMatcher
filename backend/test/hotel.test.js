import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const testDbName = `group-travel-hotel-test-${Date.now()}.db`;
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
const TWIN_ROOM = 'RM-KYO-001-A'; // TWIN, capacity 2, ₹4760/night
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
  if (res.status !== 204) data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function loginAs(name) {
  const email = demoEmailFor(name);
  await request('/api/auth/login', { method: 'POST', body: { email, password: SEED_PASSWORD } });
  const { data } = await request('/api/auth/refresh', { method: 'POST' });
  return data.accessToken;
}

let groupId;
let sarahToken;
let priyaToken;
let meeraToken;
let nonMemberToken;

before(async () => {
  migrate();
  await seedAll(SEED_PASSWORD);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      BASE = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Pick a seeded traveller who is NOT a member of the test group.
  const outsider = db
    .prepare(`SELECT t.name FROM travellers t WHERE t.traveller_id NOT IN ('T-001','T-002','T-003') LIMIT 1`)
    .get();
  nonMemberToken = await loginAs(outsider.name);

  // Sarah creates a Kyoto group 10-15 April.
  sarahToken = await loginAs('Sarah Thomas');
  const created = await request('/api/groups', {
    method: 'POST',
    token: sarahToken,
    body: {
      name: 'Kyoto Hotel Test',
      city: 'Kyoto',
      check_in: '2027-04-10',
      check_out: '2027-04-15',
      max_size: 4,
      budget_inr: 60000,
      itinerary: 'Temples and tea houses.',
    },
  });
  assert.equal(created.status, 201);
  groupId = created.data.group.group_id;

  // Priya joins for 10-12 April.
  priyaToken = await loginAs('Priya Shah');
  const priyaReq = await request(`/api/groups/${groupId}/requests`, {
    method: 'POST',
    token: priyaToken,
    body: {
      destination: 'Kyoto',
      check_in: '2027-04-10',
      check_out: '2027-04-12',
      budget_inr: 62000,
      interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'],
    },
  });
  assert.equal(priyaReq.status, 201);
  await request(`/api/requests/${priyaReq.data.request.id}`, {
    method: 'PATCH',
    token: sarahToken,
    body: { action: 'approve' },
  });

  // Meera joins for 12-15 April.
  meeraToken = await loginAs('Meera Iyer');
  const meeraReq = await request(`/api/groups/${groupId}/requests`, {
    method: 'POST',
    token: meeraToken,
    body: {
      destination: 'Kyoto',
      check_in: '2027-04-12',
      check_out: '2027-04-15',
      budget_inr: 58000,
      interests: ['TEMPLES', 'STREET_FOOD', 'NATURE'],
    },
  });
  assert.equal(meeraReq.status, 201);
  await request(`/api/requests/${meeraReq.data.request.id}`, {
    method: 'PATCH',
    token: sarahToken,
    body: { action: 'approve' },
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('hotel authorization', () => {
  it('rejects non-members from viewing the hotel plan', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: nonMemberToken });
    assert.equal(status, 403);
    assert.equal(data.error.code, 'FORBIDDEN');
  });

  it('allows approved members to view the hotel plan', async () => {
    const { status } = await request(`/api/groups/${groupId}/hotel-plan`, { token: priyaToken });
    assert.equal(status, 200);
  });

  it('only the creator can save a selection', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, {
      method: 'POST',
      token: priyaToken,
      body: { room_id: TWIN_ROOM, check_in: '2027-04-10', check_out: '2027-04-12' },
    });
    assert.equal(status, 403);
    assert.equal(data.error.code, 'FORBIDDEN');
  });
});

describe('hotel selection', () => {
  it('rejects selections outside the group trip window', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, {
      method: 'POST',
      token: sarahToken,
      body: { room_id: TWIN_ROOM, check_in: '2027-04-16', check_out: '2027-04-18' },
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, 'OUTSIDE_TRIP');
  });

  it('rejects an unknown room regardless of range', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, {
      method: 'POST',
      token: sarahToken,
      body: { room_id: 'RM-NOTEXIST', check_in: '2027-04-10', check_out: '2027-04-12' },
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, 'INVALID_ROOM');
  });

  it('enforces exclusive check-out (10-12 = nights 10,11)', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, {
      method: 'POST',
      token: sarahToken,
      body: { room_id: TWIN_ROOM, check_in: '2027-04-10', check_out: '2027-04-12' },
    });
    assert.equal(status, 201);
    assert.equal(data.selections.length, 1);
    assert.equal(data.selections[0].breakdown.rows.length, 2);
    assert.equal(data.selections[0].breakdown.rows[0].night, '2027-04-10');
    assert.equal(data.selections[0].breakdown.rows[1].night, '2027-04-11');
  });

  it('supports a second hotel for a later, non-overlapping range', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, {
      method: 'POST',
      token: sarahToken,
      body: { room_id: TWIN_ROOM, check_in: '2027-04-12', check_out: '2027-04-15' },
    });
    assert.equal(status, 201);
    assert.equal(data.selections.length, 2);
  });

  it('rejects overlapping selections', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, {
      method: 'POST',
      token: sarahToken,
      body: { room_id: TWIN_ROOM, check_in: '2027-04-11', check_out: '2027-04-13' },
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'OVERLAPPING_SELECTION');
  });
});

describe('hotel pricing & occupancy', () => {
  it('computes correct nightly occupancy from member-specific dates', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    const first = data.selections.find((s) => s.check_in === '2027-04-10');
    const second = data.selections.find((s) => s.check_in === '2027-04-12');
    // First selection 10-12: Sarah + Priya = 2 active each night.
    assert.equal(first.breakdown.rows[0].active_members, 2);
    assert.equal(first.breakdown.rows[1].active_members, 2);
    // Second selection 12-15: Sarah + Meera = 2 active each night.
    assert.equal(second.breakdown.rows.length, 3);
    for (const row of second.breakdown.rows) assert.equal(row.active_members, 2);
  });

  it('rooms required matches occupancy (1 twin room per 2 members)', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    for (const sel of data.selections) {
      for (const row of sel.breakdown.rows) assert.equal(row.rooms, 1);
    }
  });

  it('allocates costs only to members present; shares sum exactly to total', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    const first = data.selections.find((s) => s.check_in === '2027-04-10');
    const second = data.selections.find((s) => s.check_in === '2027-04-12');
    // Twin room ₹4760/night, 1 room, 2 active => ₹2380 each.
    for (const row of first.breakdown.rows) {
      assert.equal(row.total_cost, 4760);
      assert.equal(row.per_person, 2380);
    }
    for (const row of second.breakdown.rows) {
      assert.equal(row.total_cost, 4760);
      assert.equal(row.per_person, 2380);
    }
    const totalFirst = first.breakdown.rows.reduce((s, r) => s + r.total_cost, 0);
    const totalSecond = second.breakdown.rows.reduce((s, r) => s + r.total_cost, 0);
    const memberSum = Object.values(data.member_totals).reduce((s, v) => s + v, 0);
    assert.equal(memberSum, totalFirst + totalSecond);
    assert.equal(memberSum, data.total_accommodation);
  });

  it('gives each member a total matching their actual nights', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    const priyaTotal = data.member_totals['T-002'];
    const meeraTotal = data.member_totals['T-003'];
    const sarahTotal = data.member_totals['T-001'];
    // Priya: 2 nights, Meera: 3 nights, Sarah: 5 nights at ₹2380.
    assert.equal(priyaTotal, 4760);
    assert.equal(meeraTotal, 7140);
    assert.equal(sarahTotal, 11900);
  });
});

describe('hotel removal & update', () => {
  it('creator can update a selection range', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    const first = data.selections.find((s) => s.check_in === '2027-04-10');
    const { status } = await request(`/api/groups/${groupId}/hotel-plan/${first.id}`, {
      method: 'PATCH',
      token: sarahToken,
      body: { check_in: '2027-04-10', check_out: '2027-04-11' },
    });
    assert.equal(status, 200);
  });

  it('creator can remove a selection', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    const second = data.selections.find((s) => s.check_in === '2027-04-12');
    const { status, data: removed } = await request(`/api/groups/${groupId}/hotel-plan/${second.id}`, {
      method: 'DELETE',
      token: sarahToken,
    });
    assert.equal(status, 200);
    assert.ok(!removed.selections.some((s) => s.id === second.id));
  });

  it('non-creator cannot update or remove selections', async () => {
    const { data } = await request(`/api/groups/${groupId}/hotel-plan`, { token: sarahToken });
    if (data.selections.length === 0) return;
    const sel = data.selections[0];
    const upd = await request(`/api/groups/${groupId}/hotel-plan/${sel.id}`, {
      method: 'PATCH',
      token: priyaToken,
      body: { check_out: '2027-04-13' },
    });
    assert.equal(upd.status, 403);
    const del = await request(`/api/groups/${groupId}/hotel-plan/${sel.id}`, {
      method: 'DELETE',
      token: priyaToken,
    });
    assert.equal(del.status, 403);
  });
});

describe('hotel catalog browsing', () => {
  it('lists available hotel options for the group destination', async () => {
    const { status, data } = await request(`/api/groups/${groupId}/hotels`, { token: sarahToken });
    assert.equal(status, 200);
    assert.ok(data.options.length > 0);
    assert.ok(data.options.every((o) => o.city === 'Kyoto'));
    assert.ok(data.options.every((o) => o.available === true));
    assert.ok(data.options.every((o) => o.price_per_night > 0));
  });

  it('rejects browsing for non-members', async () => {
    const { status } = await request(`/api/groups/${groupId}/hotels`, { token: nonMemberToken });
    assert.equal(status, 403);
  });
});

describe('hotel persistence', () => {
  it('persists hotel selections and member dates after a backend restart', async () => {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        BASE = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    const token = await loginAs('Priya Shah');
    const { status, data } = await request(`/api/groups/${groupId}/hotel-plan`, { token });
    assert.equal(status, 200);
    assert.equal(data.selections.length, 1);

    const memberRows = db
      .prepare('SELECT traveller_id, check_in, check_out FROM group_members WHERE group_id = ?')
      .all(groupId);
    const priyaMember = memberRows.find((m) => m.traveller_id === 'T-002');
    assert.equal(priyaMember.check_in, '2027-04-10');
    assert.equal(priyaMember.check_out, '2027-04-12');
    const meeraMember = memberRows.find((m) => m.traveller_id === 'T-003');
    assert.equal(meeraMember.check_in, '2027-04-12');
    assert.equal(meeraMember.check_out, '2027-04-15');
  });
});
