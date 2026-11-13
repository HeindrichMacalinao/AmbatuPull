'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp } = require('../src/expressApp');
const poolModule = require('../src/db/pool');

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
    body: JSON.stringify({
      firstName: 'Auth',
      lastName: 'Tester',
      email,
      password,
      confirmPassword: password,
    }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  const role = body.role || body.user?.role;
  assert.equal(role, 'User');
  assert.doesNotMatch(JSON.stringify(body), new RegExp(password, 'i'));
});

test('registration rejects duplicate email with HTTP 409', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'QA',
      lastName: 'User',
      email: accounts.user.email,
      password: accounts.user.password,
      confirmPassword: accounts.user.password,
    }),
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.match(body.error, /already registered/i);
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

// ==============================================================================
// In-Process Registration Contract & Error Shielding Tests
// ==============================================================================

test('registration over express app handles successful registration, duplicate email (409), and database error shielding', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const localUrl = `http://127.0.0.1:${port}`;

  const originalGetPool = poolModule.getPool;
  let mockQueries = [];
  let queryHandler = null;

  poolModule.getPool = () => ({
    query: async (sql, params = []) => {
      mockQueries.push({ sql, params });
      if (queryHandler) return queryHandler(sql, params);
      return { rows: [], rowCount: 0 };
    },
  });

  try {
    // 1. Successful registration persists User role, createdAt, and does not leak password
    queryHandler = async (sql, params) => {
      if (sql.includes('SELECT 1 FROM app_user WHERE email')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO app_user')) {
        return {
          rows: [
            {
              userId: 99,
              firstName: params[0],
              lastName: params[1],
              email: params[2],
              role: 'User',
              isBlocked: 0,
              status: 'Active',
              stamp: params[4],
              createdAt: '2026-11-13T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };

    const resSuccess = await fetch(`${localUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@hope.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.equal(resSuccess.status, 201);
    const bodySuccess = await resSuccess.json();
    const role = bodySuccess.role || bodySuccess.user?.role;
    assert.equal(role, 'User');
    assert.equal(bodySuccess.createdAt || bodySuccess.user?.createdAt, '2026-11-13T00:00:00.000Z');
    assert.doesNotMatch(JSON.stringify(bodySuccess), /Password123!/);

    // 2. Duplicate email rejection (409)
    queryHandler = async (sql) => {
      if (sql.includes('SELECT 1 FROM app_user WHERE email')) {
        return { rows: [{ 1: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    const resDup = await fetch(`${localUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'jane.doe@hope.com',
        password: 'Password123!',
      }),
    });
    assert.equal(resDup.status, 409);
    const bodyDup = await resDup.json();
    assert.match(bodyDup.error, /already registered/i);

    // 3. Database error shielding: internal DB error is not shown raw to user
    queryHandler = async (sql) => {
      if (sql.includes('SELECT 1 FROM app_user WHERE email')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO app_user')) {
        const dbErr = new Error("Could not find the 'createdAt' column of 'app_user' in the schema cache");
        dbErr.code = 'PGRST204';
        throw dbErr;
      }
      return { rows: [], rowCount: 0 };
    };

    const resDbErr = await fetch(`${localUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'db.error@hope.com',
        password: 'Password123!',
      }),
    });
    assert.equal(resDbErr.status, 500);
    const bodyDbErr = await resDbErr.json();
    assert.doesNotMatch(bodyDbErr.error, /schema cache|createdAt|PGRST204/i);
    assert.match(bodyDbErr.error, /server error/i);
  } finally {
    poolModule.getPool = originalGetPool;
    server.close();
  }
});

