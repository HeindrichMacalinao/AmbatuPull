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
// 1. GET /api/users - Role Visibility (§1.2, §3.8)
// ==============================================================================

test('listUsers rejects unauthenticated and standard User requester', async () => {
  await assert.rejects(
    () => userService.listUsers({ requester: null }),
    (err) => err.status === 401
  );

  await assert.rejects(
    () => userService.listUsers({ requester: { role: 'User' } }),
    (err) => err.status === 403 && err.message.includes('Forbidden')
  );
});

test('listUsers for Admin strictly excludes Superadmins and flags peer Admins', async () => {
  const dbRows = [
    { userId: 1, firstName: 'QA', lastName: 'Admin', email: 'admin@hope.com', role: 'Admin', isBlocked: 0, status: 'Active', stamp: 'CREATED' },
    { userId: 2, firstName: 'QA', lastName: 'User', email: 'user@hope.com', role: 'User', isBlocked: 0, status: 'Active', stamp: 'CREATED' },
  ];

  queryHandler = async (sql) => {
    // Admin query must filter out Superadmin
    assert.ok(sql.includes("role != 'Superadmin'"), 'Admin query must filter out Superadmins');
    return { rows: dbRows, rowCount: dbRows.length };
  };

  const users = await userService.listUsers({ requester: { role: 'Admin', email: 'admin@hope.com' } });
  assert.equal(users.length, 2);

  const adminAccount = users.find((u) => u.role === 'Admin');
  const userAccount = users.find((u) => u.role === 'User');

  assert.equal(adminAccount.canManage, false, 'Peer Admin account must have canManage: false for Admin');
  assert.equal(userAccount.canManage, true, 'User account must have canManage: true');
});

test('listUsers for Superadmin returns all roles and canManage is true', async () => {
  const dbRows = [
    { userId: 1, firstName: 'Root', lastName: 'Superadmin', email: 'super@hope.com', role: 'Superadmin', isBlocked: 0, status: 'Active', stamp: 'CREATED' },
    { userId: 2, firstName: 'QA', lastName: 'Admin', email: 'admin@hope.com', role: 'Admin', isBlocked: 0, status: 'Active', stamp: 'CREATED' },
    { userId: 3, firstName: 'QA', lastName: 'User', email: 'user@hope.com', role: 'User', isBlocked: 0, status: 'Active', stamp: 'CREATED' },
  ];

  queryHandler = async (sql) => {
    assert.ok(!sql.includes("role != 'Superadmin'"), 'Superadmin query must not exclude any role');
    return { rows: dbRows, rowCount: dbRows.length };
  };

  const users = await userService.listUsers({ requester: { role: 'Superadmin', email: 'super@hope.com' } });
  assert.equal(users.length, 3);
  assert.ok(users.every((u) => u.canManage === true));
});

// ==============================================================================
// 2. POST /api/users - Add User
// ==============================================================================

test('createUser allows Admin to create User accounts only', async () => {
  // Admin attempting to create Superadmin -> 403
  await assert.rejects(
    () =>
      userService.createUser({
        data: { firstName: 'New', lastName: 'Super', email: 'newsuper@hope.com', role: 'Superadmin' },
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins can only create User accounts')
  );

  // Admin attempting to create Admin -> 403
  await assert.rejects(
    () =>
      userService.createUser({
        data: { firstName: 'New', lastName: 'Admin', email: 'newadmin@hope.com', role: 'Admin' },
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins can only create User accounts')
  );

  // Admin creating standard User -> succeeds
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM app_user WHERE email')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO app_user')) {
      return {
        rows: [
          {
            userId: 10,
            firstName: params[0],
            lastName: params[1],
            email: params[2],
            role: params[4],
            isBlocked: 0,
            empNo: params[5],
            status: 'Active',
            stamp: params[6],
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const created = await userService.createUser({
    data: { firstName: 'John', lastName: 'Doe', email: 'john.doe@hope.com' },
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(created.role, 'User');
  assert.equal(created.email, 'john.doe@hope.com');
  assert.equal(created.isBlocked, false);
});

test('createUser allows Superadmin to create Admin or Superadmin accounts', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM app_user WHERE email')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO app_user')) {
      return {
        rows: [
          {
            userId: 11,
            firstName: params[0],
            lastName: params[1],
            email: params[2],
            role: params[4],
            isBlocked: 0,
            status: 'Active',
            stamp: params[6],
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const created = await userService.createUser({
    data: { firstName: 'Branch', lastName: 'Admin', email: 'branch.admin@hope.com', role: 'Admin' },
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  assert.equal(created.role, 'Admin');
});

test('createUser validates required fields and duplicate email', async () => {
  await assert.rejects(
    () =>
      userService.createUser({
        data: { firstName: '', lastName: '', email: '' },
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400
  );

  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM app_user WHERE email')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.createUser({
        data: { firstName: 'John', lastName: 'Doe', email: 'duplicate@hope.com' },
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 409
  );
});

// ==============================================================================
// 3. PUT /api/users/:id - Edit User
// ==============================================================================

test('updateUser rejects Admin editing Admin or Superadmin accounts', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: params[0], firstName: 'Target', lastName: 'Super', email: 'super@hope.com', role: 'Superadmin' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.updateUser({
        id: 1,
        data: { firstName: 'Modified' },
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins cannot edit Admin or Superadmin accounts')
  );
});

test('updateUser allows Admin to edit standard User accounts', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: 5, firstName: 'Old', lastName: 'User', email: 'user@hope.com', role: 'User' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE app_user')) {
      return {
        rows: [{ userId: 5, firstName: params[0], lastName: params[1], email: params[2], role: 'User', isBlocked: 0, status: 'Active', stamp: params[4] }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const updated = await userService.updateUser({
    id: 5,
    data: { firstName: 'NewName' },
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(updated.firstName, 'NewName');
  assert.ok(updated.stamp.startsWith('EDITED admin@hope.com'));
});

// ==============================================================================
// 4. PUT /api/users/:id/block - Block / Unblock Toggle
// ==============================================================================

test('toggleUserBlock prevents Admin from blocking Admin or Superadmin', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: params[0], firstName: 'Peer', lastName: 'Admin', role: 'Admin', isBlocked: 0 }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      userService.toggleUserBlock({
        id: 2,
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Admins cannot block or unblock Admin or Superadmin accounts')
  );
});

test('toggleUserBlock toggles isBlocked on standard User and updates audit stamp', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE userId')) {
      return {
        rows: [{ userId: 5, firstName: 'Regular', lastName: 'User', email: 'user@hope.com', role: 'User', isBlocked: 0 }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE app_user')) {
      return {
        rows: [{ userId: 5, firstName: 'Regular', lastName: 'User', email: 'user@hope.com', role: 'User', isBlocked: params[0], stamp: params[1] }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await userService.toggleUserBlock({
    id: 5,
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(result.user.isBlocked, true);
  assert.equal(result.message, 'User has been blocked');
  assert.ok(result.user.stamp.includes('EDITED admin@hope.com (blocked)'));
});

// ==============================================================================
// 5. Express HTTP Endpoints Integration
// ==============================================================================

test('HTTP User Management endpoints enforce auth and visibility', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql) => {
    if (sql.includes('FROM app_user') && sql.includes("role != 'Superadmin'")) {
      return {
        rows: [
          { userId: 2, firstName: 'QA', lastName: 'User', email: 'user@hope.com', role: 'User', isBlocked: 0, status: 'Active', stamp: 'CREATED' },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Unauthenticated request -> 401
    const unauth = await fetch(`${baseUrl}/api/users`);
    assert.equal(unauth.status, 401);

    // 2. Standard User role -> 403
    const userForbidden = await fetch(`${baseUrl}/api/users`, {
      headers: { 'x-user-role': 'User' },
    });
    assert.equal(userForbidden.status, 403);

    // 3. Admin role -> 200
    const adminList = await fetch(`${baseUrl}/api/users`, {
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(adminList.status, 200);
    const body = await adminList.json();
    assert.ok(Array.isArray(body.users));
    assert.equal(body.users.length, 1);
  } finally {
    server.close();
  }
});
