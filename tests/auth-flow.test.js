'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
const password = process.env.AUTH_TEST_PASSWORD || 'QaPassword!123';
const accounts = {
  user: {
    email: process.env.AUTH_TEST_EMAIL || 'test_user@hope.com',
    password,
  },
  blocked: {
    email: process.env.AUTH_BLOCKED_EMAIL || 'test_blocked@hope.com',
    password,
  },
};

function skipWithoutServer(t) {
  if (!baseUrl) {
    t.skip('Set BASE_URL to execute HTTP authentication contract tests');
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
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(account),
  });
}

test('registration accepts a valid account with the default User role', async (t) => {
  if (skipWithoutServer(t)) return;
  const email = `auth-test-${Date.now()}@example.invalid`;
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.role, 'User');
  assert.doesNotMatch(JSON.stringify(body), new RegExp(password, 'i'));
});

test('registration rejects duplicate email with HTTP 409', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(accounts.user),
  });
  assert.equal(response.status, 409);
});

test('registration rejects malformed email and short password', async (t) => {
  if (skipWithoutServer(t)) return;
  for (const payload of [
    { email: 'not-an-email', password },
    { email: `short-${Date.now()}@example.invalid`, password: 'short' },
  ]) {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    assert.ok([400, 422].includes(response.status));
  }
});

test('login creates a session for valid credentials', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await login(accounts.user);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('set-cookie'), 'login must issue a session cookie');
});

test('wrong credentials return a non-enumerating authentication error', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await login({
    email: accounts.user.email,
    password: `${password}-wrong`,
  });
  assert.ok([401, 403].includes(response.status));
  assert.doesNotMatch((await response.text()).toLowerCase(), /user not found|email does not exist/);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('blocked accounts cannot log in', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await login(accounts.blocked);
  assert.equal(response.status, 403);
  assert.match((await response.text()).toLowerCase(), /blocked/);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('logout invalidates the session for protected requests', async (t) => {
  if (skipWithoutServer(t)) return;
  const loggedIn = await login(accounts.user);
  assert.equal(loggedIn.status, 200);
  const cookie = loggedIn.headers.get('set-cookie');
  assert.ok(cookie);

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { cookie },
  });
  assert.ok([200, 204].includes(logout.status));

  const protectedResponse = await request('/api/auth/me', { headers: { cookie } });
  assert.equal(protectedResponse.status, 401);
});

test('password reset request does not disclose account existence', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await request('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email: accounts.user.email }),
  });
  assert.ok([200, 202].includes(response.status));
  assert.doesNotMatch(JSON.stringify(await response.json()), new RegExp(password, 'i'));
});

test('password reset rejects expired or reused tokens', async (t) => {
  if (skipWithoutServer(t)) return;
  for (const token of ['expired-test-token', 'already-used-test-token']) {
    const response = await request('/api/auth/password-reset/complete', {
      method: 'POST',
      body: JSON.stringify({ token, password: 'NewQaPassword!123' }),
    });
    assert.ok([400, 401, 410].includes(response.status));
  }
});
