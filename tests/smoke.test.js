'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
const password = process.env.SMOKE_PASSWORD || 'QaPassword!123';
const accounts = {
  superadmin: {
    email: process.env.SMOKE_SUPERADMIN_EMAIL || 'test_superadmin@hope.com',
    password,
  },
  user: {
    email: process.env.SMOKE_USER_EMAIL || 'test_user.norights@hope.com',
    password,
  },
  blocked: {
    email: process.env.SMOKE_BLOCKED_EMAIL || 'test_blocked@hope.com',
    password,
  },
};

function skipWithoutServer(t) {
  if (!baseUrl) {
    t.skip('Set BASE_URL to execute smoke tests');
    return true;
  }
  return false;
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function login(account) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(account),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie');
}

test('smoke: Superadmin login reaches dashboard and full navigation', async (t) => {
  if (skipWithoutServer(t)) return;
  const cookie = await login(accounts.superadmin);
  const response = await request('/dashboard', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /dashboard|kpi/i);
  assert.match(body, /user management|customer|product|human resources|sales|reports/i);
});

test('smoke: restricted User sees only authorized navigation', async (t) => {
  if (skipWithoutServer(t)) return;
  const cookie = await login(accounts.user);
  const response = await request('/dashboard', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.doesNotMatch(body, /user management|rights matrix|admin settings/i);
});

test('smoke: blocked credentials show a blocked notification', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(accounts.blocked),
  });
  assert.equal(response.status, 403);
  assert.match((await response.text()).toLowerCase(), /blocked/);
});

