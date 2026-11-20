'use strict';

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');
const { test, beforeEach, afterEach } = require('node:test');
const { createApp } = require('../src/expressApp');
const poolModule = require('../src/db/pool');
const authService = require('../src/services/authService');
const userService = require('../src/services/userService');

const root = path.resolve(__dirname, '..');
let originalGetPool;
let queryHandler;

const fakePool = {
  query: async (sql, params = []) => queryHandler(sql, params),
};

beforeEach(() => {
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
  queryHandler = async () => ({ rows: [], rowCount: 0 });
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

test('TC-REG-AUTH: registration hashes passwords and login issues a session cookie', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let insertedHash;
  const userRow = {
    userId: 41,
    firstName: 'Regression',
    lastName: 'User',
    email: 'regression@example.invalid',
    role: 'User',
    isBlocked: 0,
    status: 'Active',
    createdAt: '2026-11-20T00:00:00.000Z',
  };

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM app_user WHERE email')) return { rows: [], rowCount: 0 };
    if (sql.includes('INSERT INTO app_user')) {
      insertedHash = params[3];
      return { rows: [{ ...userRow, stamp: params[4] }], rowCount: 1 };
    }
    if (sql.includes('SELECT * FROM app_user WHERE email')) {
      return { rows: [{ ...userRow, passwordHash: insertedHash }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    const password = 'RegressionPassword!123';
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: userRow.firstName,
        lastName: userRow.lastName,
        email: userRow.email,
        password,
        confirmPassword: password,
      }),
    });
    assert.equal(register.status, 201);
    assert.equal(await bcrypt.compare(password, insertedHash), true);
    assert.doesNotMatch(JSON.stringify(await register.json()), new RegExp(password));

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userRow.email, password }),
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie') || '', /token=/);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: login.headers.get('set-cookie') },
    });
    assert.equal(logout.status, 200);
  } finally {
    server.close();
  }
});

test('TC-REG-BLOCKED: blocked session tokens cannot access Customer or Product APIs', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{
          userId: 7,
          email: 'blocked@hope.com',
          role: 'User',
          isBlocked: 1,
          status: 'Active',
        }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    const cookie = `token=${Buffer.from('7').toString('base64')}`;
    for (const endpoint of ['/api/customers', '/api/products']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
        headers: { cookie },
      });
      assert.equal(response.status, 403, `${endpoint} must reject blocked users`);
      assert.match((await response.text()).toLowerCase(), /blocked/);
    }
  } finally {
    server.close();
  }
});

test('TC-REG-USER-MGMT: Admin listing excludes Superadmin accounts', async () => {
  queryHandler = async (sql) => {
    assert.match(sql, /role != 'Superadmin'/);
    return {
      rows: [
        { userId: 2, email: 'admin@hope.com', role: 'Admin', isBlocked: 0, status: 'Active' },
        { userId: 3, email: 'user@hope.com', role: 'User', isBlocked: 0, status: 'Active' },
      ],
      rowCount: 2,
    };
  };

  const users = await userService.listUsers({ requester: { role: 'Admin', email: 'admin@hope.com' } });
  assert.equal(users.some((user) => user.role === 'Superadmin'), false);
  assert.equal(users.find((user) => user.role === 'Admin').canManage, false);
});

test('TC-REG-LAST-SA: last active Superadmin cannot be demoted, blocked, or deactivated', async () => {
  const soleSuperadmin = {
    userId: 1,
    email: 'sole.super@hope.com',
    role: 'Superadmin',
    isBlocked: 0,
    status: 'Active',
  };
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return { rows: [soleSuperadmin], rowCount: 1 };
    }
    if (sql.includes("SELECT COUNT(*) AS count FROM app_user WHERE role = 'Superadmin'")) {
      return { rows: [{ count: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const requester = { role: 'Superadmin', email: 'sole.super@hope.com' };
  const expected = 'Action blocked: Cannot remove, demote, or disable the last remaining Superadmin.';

  await assert.rejects(() => userService.updateUserRole({ id: 1, role: 'Admin', requester }), (error) => error.status === 403 && error.message === expected);
  await assert.rejects(() => userService.toggleUserBlock({ id: 1, requester }), (error) => error.status === 403 && error.message === expected);
  await assert.rejects(() => userService.updateUser({ id: 1, data: { status: 'Inactive' }, requester }), (error) => error.status === 403 && error.message === expected);
});

test('TC-REG-SMOKE: smoke suite retains the three Sprint 1 regression scenarios', () => {
  const source = fs.readFileSync(path.join(root, 'tests/smoke.test.js'), 'utf8');
  assert.match(source, /Superadmin login reaches dashboard/);
  assert.match(source, /restricted User sees only authorized navigation/);
  assert.match(source, /blocked credentials show a blocked notification/);
});
