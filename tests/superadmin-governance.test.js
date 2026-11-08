'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const userService = require('../src/services/userService');
const { createApp } = require('../src/expressApp');

let mockQueries = [];
let queryHandler = null;

const fakePool = {
  query: async (sql, params = []) => {
    mockQueries.push({ sql, params });
    if (queryHandler) {
      return queryHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  },
};

let originalGetPool;

beforeEach(() => {
  mockQueries = [];
  queryHandler = null;
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

// ==============================================================================
// 1. Role Promotion & Demotion Permissions (S1-DEV-06)
// ==============================================================================

test('updateUserRole strictly rejects non-Superadmin requesters with 403', async () => {
  // 1. Unauthenticated -> 401
  await assert.rejects(
    () => userService.updateUserRole({ id: 2, role: 'Admin', requester: null }),
    (err) => err.status === 401
  );

  // 2. Admin requester -> 403
  await assert.rejects(
    () =>
      userService.updateUserRole({
        id: 2,
        role: 'Admin',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('only Superadmin can modify user roles')
  );

  // 3. User requester -> 403
  await assert.rejects(
    () =>
      userService.updateUserRole({
        id: 2,
        role: 'Admin',
        requester: { role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('only Superadmin can modify user roles')
  );
});

test('updateUserRole validates input and target user existence', async () => {
  // Missing role -> 400
  await assert.rejects(
    () =>
      userService.updateUserRole({
        id: 2,
        role: '',
        requester: { role: 'Superadmin', email: 'super@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('Role is required')
  );

  // Invalid role -> 400
  await assert.rejects(
    () =>
      userService.updateUserRole({
        id: 2,
        role: 'Manager',
        requester: { role: 'Superadmin', email: 'super@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('Invalid role specified')
  );

  // Nonexistent user -> 404
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.updateUserRole({
        id: 999,
        role: 'Admin',
        requester: { role: 'Superadmin', email: 'super@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('User not found')
  );
});

// ==============================================================================
// 2. Last-Superadmin Safeguard Rule (S1-DEV-06)
// ==============================================================================

test('Last-Superadmin Guard: Demoting sole active Superadmin is rejected with HTTP 403', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 1,
            firstName: 'Sole',
            lastName: 'Superadmin',
            email: 'sole.super@hope.com',
            role: 'Superadmin',
            isBlocked: 0,
            status: 'Active',
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT COUNT(*) AS count FROM app_user WHERE role = \'Superadmin\'')) {
      // Exactly 1 active superadmin
      return { rows: [{ count: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.updateUserRole({
        id: 1,
        role: 'Admin',
        requester: { role: 'Superadmin', email: 'sole.super@hope.com' },
      }),
    (err) =>
      err.status === 403 &&
      err.message === 'Action blocked: Cannot remove, demote, or disable the last remaining Superadmin.'
  );
});

test('Last-Superadmin Guard: Blocking sole active Superadmin is rejected with HTTP 403', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 1,
            firstName: 'Sole',
            lastName: 'Superadmin',
            email: 'sole.super@hope.com',
            role: 'Superadmin',
            isBlocked: 0,
            status: 'Active',
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT COUNT(*) AS count FROM app_user WHERE role = \'Superadmin\'')) {
      return { rows: [{ count: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.toggleUserBlock({
        id: 1,
        isBlocked: true,
        requester: { role: 'Superadmin', email: 'sole.super@hope.com' },
      }),
    (err) =>
      err.status === 403 &&
      err.message === 'Action blocked: Cannot remove, demote, or disable the last remaining Superadmin.'
  );
});

test('Last-Superadmin Guard: Deactivating sole active Superadmin is rejected with HTTP 403', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 1,
            firstName: 'Sole',
            lastName: 'Superadmin',
            email: 'sole.super@hope.com',
            role: 'Superadmin',
            isBlocked: 0,
            status: 'Active',
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT COUNT(*) AS count FROM app_user WHERE role = \'Superadmin\'')) {
      return { rows: [{ count: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.updateUser({
        id: 1,
        data: { status: 'Inactive' },
        requester: { role: 'Superadmin', email: 'sole.super@hope.com' },
      }),
    (err) =>
      err.status === 403 &&
      err.message === 'Action blocked: Cannot remove, demote, or disable the last remaining Superadmin.'
  );
});

test('Demoting a Superadmin succeeds when multiple active Superadmins exist', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 2,
            firstName: 'Second',
            lastName: 'Superadmin',
            email: 'second.super@hope.com',
            role: 'Superadmin',
            isBlocked: 0,
            status: 'Active',
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT COUNT(*) AS count FROM app_user WHERE role = \'Superadmin\'')) {
      // 2 active superadmins exist
      return { rows: [{ count: 2 }], rowCount: 1 };
    }
    if (sql.includes('UPDATE app_user SET role')) {
      return {
        rows: [
          {
            userId: 2,
            firstName: 'Second',
            lastName: 'Superadmin',
            email: 'second.super@hope.com',
            role: params[0],
            isBlocked: 0,
            status: 'Active',
            stamp: params[1],
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await userService.updateUserRole({
    id: 2,
    role: 'Admin',
    requester: { role: 'Superadmin', email: 'first.super@hope.com' },
  });

  assert.equal(result.user.role, 'Admin');
  assert.equal(result.message, 'User role updated to Admin');

  // Verify audit log insertion was executed
  const auditInsert = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditInsert, 'Role change must be recorded in audit_log');
  assert.equal(auditInsert.params[0], 'first.super@hope.com');
  assert.equal(auditInsert.params[1], '2');
  assert.match(auditInsert.params[2], /"field":"role"/);
});

test('Promoting a standard User to Admin or Superadmin succeeds', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 10,
            firstName: 'Standard',
            lastName: 'User',
            email: 'std.user@hope.com',
            role: 'User',
            isBlocked: 0,
            status: 'Active',
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE app_user SET role')) {
      return {
        rows: [
          {
            userId: 10,
            firstName: 'Standard',
            lastName: 'User',
            email: 'std.user@hope.com',
            role: params[0],
            isBlocked: 0,
            status: 'Active',
            stamp: params[1],
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await userService.updateUserRole({
    id: 10,
    role: 'Superadmin',
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  assert.equal(result.user.role, 'Superadmin');
  assert.equal(result.message, 'User role updated to Superadmin');
});

// ==============================================================================
// 3. HTTP Express Endpoint Integration
// ==============================================================================

test('HTTP PUT /api/users/:id/role enforces Superadmin role guard', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 5,
            firstName: 'Target',
            lastName: 'User',
            email: 'target@hope.com',
            role: 'User',
            isBlocked: 0,
            status: 'Active',
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE app_user SET role')) {
      return {
        rows: [
          {
            userId: 5,
            firstName: 'Target',
            lastName: 'User',
            email: 'target@hope.com',
            role: params[0],
            isBlocked: 0,
            status: 'Active',
            stamp: params[1],
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Admin requester -> 403 Forbidden
    const adminRes = await fetch(`${baseUrl}/api/users/5/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
      },
      body: JSON.stringify({ role: 'Admin' }),
    });
    assert.equal(adminRes.status, 403);

    // 2. Superadmin requester -> 200 OK
    const superRes = await fetch(`${baseUrl}/api/users/5/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Superadmin',
      },
      body: JSON.stringify({ role: 'Admin' }),
    });
    assert.equal(superRes.status, 200);
    const body = await superRes.json();
    assert.equal(body.user.role, 'Admin');
  } finally {
    server.close();
  }
});
