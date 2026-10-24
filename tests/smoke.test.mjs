import { test } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
const credentials = {
  superadmin: { email: process.env.SMOKE_SUPERADMIN_EMAIL ?? 'qa.superadmin@hope.com', password: process.env.SMOKE_SUPERADMIN_PASSWORD ?? 'QaPassword!123' },
  user: { email: process.env.SMOKE_USER_EMAIL ?? 'qa.user@hope.com', password: process.env.SMOKE_USER_PASSWORD ?? 'QaPassword!123' },
  blocked: { email: process.env.SMOKE_BLOCKED_EMAIL ?? 'qa.blocked@hope.com', password: process.env.SMOKE_BLOCKED_PASSWORD ?? 'QaPassword!123' },
};

async function login(account) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(account),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie') ?? '';
}

test('smoke: superadmin can log in and reach dashboard', async (t) => {
  if (!baseUrl) return t.skip('Set BASE_URL to run smoke tests');
  const cookie = await login(credentials.superadmin);
  const dashboard = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /dashboard|kpi/i);
});

test('smoke: restricted user reaches dashboard without admin navigation', async (t) => {
  if (!baseUrl) return t.skip('Set BASE_URL to run smoke tests');
  const cookie = await login(credentials.user);
  const dashboard = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
  assert.equal(dashboard.status, 200);
  assert.doesNotMatch(await dashboard.text(), /user management|rights matrix/i);
});

test('smoke: blocked credentials are rejected', async (t) => {
  if (!baseUrl) return t.skip('Set BASE_URL to run smoke tests');
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials.blocked),
  });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /blocked/i);
});
