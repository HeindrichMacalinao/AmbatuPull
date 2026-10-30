'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
const password = process.env.AUTH_TEST_PASSWORD || 'QaPassword!123';
const accounts = {
  superadmin: { email: 'test_superadmin@hope.com', password },
  admin: { email: 'test_admin@hope.com', password },
  peerAdmin: { email: 'test_admin.peer@hope.com', password },
  user: { email: 'test_user@hope.com', password },
  blocked: { email: 'test_blocked@hope.com', password },
};

function skipWithoutServer(t) {
  if (!baseUrl) {
    t.skip('Set BASE_URL to execute HTTP user-management contract tests');
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

async function as(account, path, options = {}) {
  const cookie = await login(account);
  return request(path, {
    ...options,
    headers: { ...(options.headers || {}), cookie },
  });
}

test('Admin cannot list or directly read Superadmin accounts', async (t) => {
  if (skipWithoutServer(t)) return;
  const list = await as(accounts.admin, '/api/users');
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.doesNotMatch(JSON.stringify(body), /test_superadmin@hope\.com/i);

  const direct = await as(accounts.admin, '/api/users/test_superadmin@hope.com');
  assert.ok([403, 404].includes(direct.status));
});

test('Admin cannot mutate a peer Admin account', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await as(accounts.admin, '/api/users/test_admin.peer@hope.com', {
    method: 'PATCH',
    body: JSON.stringify({ firstName: 'Unauthorized' }),
  });
  assert.equal(response.status, 403);
});

test('Superadmin can list all role types and see audit fields', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await as(accounts.superadmin, '/api/users');
  assert.equal(response.status, 200);
  const body = JSON.stringify(await response.json());
  assert.match(body, /test_superadmin@hope\.com/);
  assert.match(body, /test_admin@hope\.com/);
  assert.match(body, /test_user@hope\.com/);
  assert.match(body, /status|stamp/i);
});

test('Admin can block an eligible User and the target cannot authenticate', async (t) => {
  if (skipWithoutServer(t)) return;
  const block = await as(accounts.admin, '/api/users/test_user@hope.com/block', {
    method: 'POST',
  });
  assert.ok([200, 204].includes(block.status));

  const blockedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(accounts.user),
  });
  assert.equal(blockedLogin.status, 403);
  assert.match((await blockedLogin.text()).toLowerCase(), /blocked/);
});

test('blocked users lose access to protected endpoints immediately', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await as(accounts.blocked, '/api/users');
  assert.ok([401, 403].includes(response.status));
});

test('Admin can unblock an eligible User and restore login', async (t) => {
  if (skipWithoutServer(t)) return;
  const unblock = await as(accounts.admin, '/api/users/test_blocked@hope.com/unblock', {
    method: 'POST',
  });
  assert.ok([200, 204].includes(unblock.status));

  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(accounts.blocked),
  });
  assert.equal(loginResponse.status, 200);
});

test('the sole active Superadmin cannot be blocked, demoted, or deleted', async (t) => {
  if (skipWithoutServer(t)) return;
  for (const [path, options] of [
    ['/api/users/test_superadmin@hope.com/block', { method: 'POST' }],
    ['/api/users/test_superadmin@hope.com', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'Admin' }),
    }],
    ['/api/users/test_superadmin@hope.com', { method: 'DELETE' }],
  ]) {
    const response = await as(accounts.superadmin, path, options);
    assert.equal(response.status, 403);
  }
});

test('user-management mutations report an audit stamp', async (t) => {
  if (skipWithoutServer(t)) return;
  const response = await as(accounts.superadmin, '/api/users/test_user@hope.com', {
    method: 'PATCH',
    body: JSON.stringify({ firstName: 'Updated' }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(JSON.stringify(body), /stamp|updatedAt|audit/i);
});
