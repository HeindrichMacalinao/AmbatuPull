'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const userService = require('../src/services/userService');
const { createApp } = require('../src/app');

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
// 1. GET /api/users/:id/rights Tests (S1-DEV-07)
// ==============================================================================

test('getUserRights rejects unauthenticated and standard User requesters with 401 / 403', async () => {
  // 1. Unauthenticated -> 401
  await assert.rejects(
    () => userService.getUserRights({ id: 2, requester: null }),
    (err) => err.status === 401
  );

  // 2. Standard User -> 403
  await assert.rejects(
    () =>
      userService.getUserRights({
        id: 2,
        requester: { role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Forbidden')
  );
});

test('getUserRights prevents Admin from inspecting rights of Admin or Superadmin (403)', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      const id = params[0];
      return {
        rows: [
          {
            userId: id,
            firstName: 'Peer',
            lastName: 'Account',
            email: id === 10 ? 'super@hope.com' : 'adminpeer@hope.com',
            role: id === 10 ? 'Superadmin' : 'Admin',
            status: 'Active',
            isBlocked: 0,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  // Admin inspecting Superadmin -> 403
  await assert.rejects(
    () =>
      userService.getUserRights({
        id: 10,
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins can only view rights of standard User accounts')
  );

  // Admin inspecting peer Admin -> 403
  await assert.rejects(
    () =>
      userService.getUserRights({
        id: 11,
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins can only view rights of standard User accounts')
  );
});

test('getUserRights allows Superadmin to inspect rights of any user', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: params[0],
            firstName: 'Any',
            lastName: 'Account',
            email: 'admin@hope.com',
            role: 'Admin',
            status: 'Active',
            isBlocked: 0,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode FROM user_permission')) {
      return {
        rows: [
          { rightCode: 'customer.add' },
          { rightCode: 'customer.edit' },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const res = await userService.getUserRights({
    id: 3,
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  assert.equal(res.userId, 3);
  assert.deepEqual(res.rightCodes, ['customer.add', 'customer.edit']);
});

test('getUserRights allows Admin to inspect rights of standard User and returns active rightCodes', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: params[0],
            firstName: 'Standard',
            lastName: 'User',
            email: 'user@hope.com',
            role: 'User',
            status: 'Active',
            isBlocked: 0,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode FROM user_permission')) {
      return {
        rows: [
          { rightCode: 'product.add' },
          { rightCode: 'product.edit' },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const res = await userService.getUserRights({
    id: 5,
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(res.userId, 5);
  assert.deepEqual(res.rightCodes, ['product.add', 'product.edit']);
});

// ==============================================================================
// 2. PUT /api/users/:id/rights Tests (S1-DEV-07)
// ==============================================================================

test('updateUserRights rejects unauthenticated and standard User requesters with 401 / 403', async () => {
  // 1. Unauthenticated -> 401
  await assert.rejects(
    () =>
      userService.updateUserRights({
        id: 2,
        rightCodes: ['customer.add'],
        requester: null,
      }),
    (err) => err.status === 401
  );

  // 2. User role -> 403
  await assert.rejects(
    () =>
      userService.updateUserRights({
        id: 2,
        rightCodes: ['customer.add'],
        requester: { role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Forbidden')
  );
});

test('updateUserRights prevents Admin from modifying rights of Admin or Superadmin (403)', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: params[0],
            firstName: 'Admin',
            lastName: 'Peer',
            email: 'adminpeer@hope.com',
            role: 'Admin',
            status: 'Active',
            isBlocked: 0,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.updateUserRights({
        id: 2,
        rightCodes: ['customer.add'],
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins can only modify rights of standard User accounts')
  );
});

test('updateUserRights validates rightCodes payload (must be array of strings)', async () => {
  // 1. Non-array -> 400
  await assert.rejects(
    () =>
      userService.updateUserRights({
        id: 2,
        rightCodes: 'customer.add',
        requester: { role: 'Superadmin', email: 'super@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('must be an array')
  );

  // 2. Non-string element -> 400
  await assert.rejects(
    () =>
      userService.updateUserRights({
        id: 2,
        rightCodes: [123],
        requester: { role: 'Superadmin', email: 'super@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('non-empty string')
  );
});

test('updateUserRights validates submitted rightCodes against rights table (rejects invalid codes with 400)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: 5, role: 'User', status: 'Active' }],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode FROM rights')) {
      return {
        rows: [
          { rightCode: 'customer.add' },
          { rightCode: 'customer.edit' },
          { rightCode: 'customer.delete' },
        ],
        rowCount: 3,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.updateUserRights({
        id: 5,
        rightCodes: ['customer.add', 'customer.hack_database', 'fake.right'],
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('Invalid right code(s): customer.hack_database, fake.right')
  );
});

test('updateUserRights synchronizes permissions: inserts missing and deactivates unchecked rights', async () => {
  const executedSql = [];
  queryHandler = async (sql, params) => {
    executedSql.push({ sql, params });

    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: 7, role: 'User', status: 'Active', stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode FROM rights')) {
      return {
        rows: [
          { rightCode: 'customer.add' },
          { rightCode: 'customer.edit' },
          { rightCode: 'customer.delete' },
          { rightCode: 'product.add' },
        ],
        rowCount: 4,
      };
    }
    if (sql.includes('SELECT rightCode, status FROM user_permission WHERE userId')) {
      return {
        rows: [
          { rightCode: 'customer.add', status: 'Active' },
          { rightCode: 'customer.delete', status: 'Active' },
          { rightCode: 'product.add', status: 'Inactive' },
        ],
        rowCount: 3,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  // We request: ['customer.add', 'customer.edit', 'product.add']
  // - 'customer.add': already Active -> unchanged
  // - 'customer.edit': not in existing -> INSERT Active
  // - 'product.add': was Inactive -> UPDATE Active
  // - 'customer.delete': was Active, not requested -> UPDATE Inactive
  const result = await userService.updateUserRights({
    id: 7,
    rightCodes: ['customer.add', 'customer.edit', 'product.add'],
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  assert.equal(result.userId, 7);
  assert.deepEqual(result.granted.sort(), ['customer.edit', 'product.add'].sort());
  assert.deepEqual(result.revoked, ['customer.delete']);

  // Verify queries executed
  const insertCalls = executedSql.filter((q) => q.sql.includes('INSERT INTO user_permission'));
  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].params[1], 'customer.edit');

  const updateActiveCalls = executedSql.filter(
    (q) => q.sql.includes('UPDATE user_permission SET status') && q.params[0] === 'Active'
  );
  assert.equal(updateActiveCalls.length, 1);
  assert.equal(updateActiveCalls[0].params[3], 'product.add');

  const updateInactiveCalls = executedSql.filter(
    (q) => q.sql.includes('UPDATE user_permission SET status') && q.params[0] === 'Inactive'
  );
  assert.equal(updateInactiveCalls.length, 1);
  assert.equal(updateInactiveCalls[0].params[3], 'customer.delete');

  // Verify app_user stamp update
  const stampUserCalls = executedSql.filter((q) => q.sql.includes('UPDATE app_user SET stamp'));
  assert.equal(stampUserCalls.length, 1);
  assert.ok(stampUserCalls[0].params[0].startsWith('RIGHTS_UPDATED super@hope.com'));

  // Verify audit_log entry
  const auditCalls = executedSql.filter((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].params[0], 'super@hope.com');
  assert.equal(auditCalls[0].params[1], '7');
  const auditDetails = JSON.parse(auditCalls[0].params[2]);
  assert.deepEqual(auditDetails.granted.sort(), ['customer.edit', 'product.add'].sort());
  assert.deepEqual(auditDetails.revoked, ['customer.delete']);
});

test('updateUserRights handles empty rightCodes array (revokes all active rights)', async () => {
  const executedSql = [];
  queryHandler = async (sql, params) => {
    executedSql.push({ sql, params });

    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: 8, role: 'User', status: 'Active' }],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode FROM rights')) {
      return { rows: [{ rightCode: 'customer.add' }], rowCount: 1 };
    }
    if (sql.includes('SELECT rightCode, status FROM user_permission WHERE userId')) {
      return {
        rows: [{ rightCode: 'customer.add', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await userService.updateUserRights({
    id: 8,
    rightCodes: [],
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(result.userId, 8);
  assert.deepEqual(result.granted, []);
  assert.deepEqual(result.revoked, ['customer.add']);
});

// ==============================================================================
// 3. HTTP Integration via Express App (S1-DEV-07)
// ==============================================================================

test('HTTP GET and PUT /api/users/:id/rights enforce auth, permissions and persist updates', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [
          {
            userId: 9,
            firstName: 'HTTP',
            lastName: 'Target',
            email: 'target@hope.com',
            role: 'User',
            status: 'Active',
            isBlocked: 0,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode FROM rights')) {
      return {
        rows: [
          { rightCode: 'customer.add' },
          { rightCode: 'customer.edit' },
        ],
        rowCount: 2,
      };
    }
    if (sql.includes("SELECT rightCode FROM user_permission WHERE userId = $1 AND status = 'Active'")) {
      return {
        rows: [{ rightCode: 'customer.add' }],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT rightCode, status FROM user_permission WHERE userId')) {
      return {
        rows: [{ rightCode: 'customer.add', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Unauthenticated GET -> 401
    const unauthGet = await fetch(`${baseUrl}/api/users/9/rights`);
    assert.equal(unauthGet.status, 401);

    // 2. Standard User GET -> 403
    const userGet = await fetch(`${baseUrl}/api/users/9/rights`, {
      headers: { 'x-user-role': 'User' },
    });
    assert.equal(userGet.status, 403);

    // 3. Admin GET standard user -> 200
    const adminGet = await fetch(`${baseUrl}/api/users/9/rights`, {
      headers: { 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.com' },
    });
    assert.equal(adminGet.status, 200);
    const getBody = await adminGet.json();
    assert.deepEqual(getBody.rightCodes, ['customer.add']);

    // 4. Admin PUT with invalid rightCode -> 400
    const badPut = await fetch(`${baseUrl}/api/users/9/rights`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
      body: JSON.stringify({ rightCodes: ['nonexistent.right'] }),
    });
    assert.equal(badPut.status, 400);

    // 5. Admin PUT with valid rightCodes -> 200
    const goodPut = await fetch(`${baseUrl}/api/users/9/rights`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
      body: JSON.stringify({ rightCodes: ['customer.add', 'customer.edit'] }),
    });
    assert.equal(goodPut.status, 200);
    const putBody = await goodPut.json();
    assert.deepEqual(putBody.rightCodes, ['customer.add', 'customer.edit']);
    assert.deepEqual(putBody.granted, ['customer.edit']);
  } finally {
    server.close();
  }
});
