'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const customerService = require('../src/services/customerService');
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
// 1. POST /api/customers — Create Customer Permissions (§3.8, §4.2, S2-DEV-02)
// ==============================================================================

test('createCustomer rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () =>
      customerService.createCustomer({
        data: { custNo: 'C0100', custName: 'New Corp', payTerms: 'Net 30' },
        requester: null,
      }),
    (err) => err.status === 401
  );
});

test('createCustomer rejects standard User without customer.add right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.createCustomer({
        data: { custNo: 'C0100', custName: 'New Corp', payTerms: 'Net 30' },
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'customer.add'")
  );
});

test('createCustomer allows Superadmin and Admin automatically', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM CUSTOMER WHERE custNo')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO CUSTOMER')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminResult = await customerService.createCustomer({
    data: { custNo: 'C0100', custName: 'New Corp', payTerms: 'Net 30', address: '123 Main' },
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminResult.custNo, 'C0100');
  assert.equal(adminResult.status, 'Active');

  const superResult = await customerService.createCustomer({
    data: { custNo: 'C0101', custName: 'Super Corp', payTerms: 'COD' },
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });
  assert.equal(superResult.custNo, 'C0101');
  assert.equal(superResult.status, 'Active');
});

test('createCustomer allows standard User when customer.add right is active', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT 1 FROM CUSTOMER WHERE custNo')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO CUSTOMER')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const userResult = await customerService.createCustomer({
    data: { custNo: 'C0102', custName: 'User Corp', payTerms: 'Net 15' },
    requester: { userId: 10, role: 'User', email: 'user@hope.com' },
  });
  assert.equal(userResult.custNo, 'C0102');
  assert.equal(userResult.payTerms, 'Net 15');
});

// ==============================================================================
// 2. POST /api/customers — Input Validation & Stamp Generation (S2-DEV-02)
// ==============================================================================

test('createCustomer validates required fields and length limits', async () => {
  const requester = { role: 'Admin', email: 'admin@hope.com' };

  // 1. Missing custNo
  await assert.rejects(
    () => customerService.createCustomer({ data: { custName: 'Corp', payTerms: 'Net 30' }, requester }),
    (err) => err.status === 400 && err.message.includes('Customer number is required')
  );

  // 2. custNo exceeding 10 characters
  await assert.rejects(
    () => customerService.createCustomer({ data: { custNo: 'C-1234567890', custName: 'Corp', payTerms: 'Net 30' }, requester }),
    (err) => err.status === 400 && err.message.includes('must not exceed 10 characters')
  );

  // 3. Missing custName
  await assert.rejects(
    () => customerService.createCustomer({ data: { custNo: 'C0105', custName: '', payTerms: 'Net 30' }, requester }),
    (err) => err.status === 400 && err.message.includes('Customer name is required')
  );

  // 4. custName exceeding 100 characters
  await assert.rejects(
    () => customerService.createCustomer({ data: { custNo: 'C0105', custName: 'A'.repeat(101), payTerms: 'Net 30' }, requester }),
    (err) => err.status === 400 && err.message.includes('must not exceed 100 characters')
  );

  // 5. address exceeding 200 characters
  await assert.rejects(
    () => customerService.createCustomer({ data: { custNo: 'C0105', custName: 'Valid', address: 'B'.repeat(201), payTerms: 'Net 30' }, requester }),
    (err) => err.status === 400 && err.message.includes('Address must not exceed 200 characters')
  );
});

test('createCustomer validates payment terms against allowed values', async () => {
  const requester = { role: 'Admin', email: 'admin@hope.com' };

  // Invalid payment term -> 400
  await assert.rejects(
    () =>
      customerService.createCustomer({
        data: { custNo: 'C0106', custName: 'Test Corp', payTerms: 'Net 90' },
        requester,
      }),
    (err) => err.status === 400 && err.message.includes('Invalid payment terms')
  );

  queryHandler = async () => ({ rows: [], rowCount: 1 });

  // Allowed values: 'Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid'
  for (const term of ['Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid']) {
    const res = await customerService.createCustomer({
      data: { custNo: `C010_${term.slice(0, 3)}`, custName: 'Test Corp', payTerms: term.toLowerCase() },
      requester,
    });
    assert.equal(res.payTerms, term);
  }
});

test('createCustomer checks uniqueness of custNo (rejects duplicate with 409)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM CUSTOMER WHERE custNo')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.createCustomer({
        data: { custNo: 'C0001', custName: 'Duplicate Corp', payTerms: 'Net 30' },
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 409 && err.message.includes('already exists')
  );
});

test('createCustomer generates CREATED audit stamp and logs to audit_log (§2.3)', async () => {
  const executedSql = [];
  queryHandler = async (sql, params) => {
    executedSql.push({ sql, params });
    return { rows: [], rowCount: 1 };
  };

  const requester = { role: 'Admin', email: 'admin@hope.com' };
  const res = await customerService.createCustomer({
    data: { custNo: 'C0200', custName: 'Audit Test Corp', address: '777 Hope Way', payTerms: 'Net 30' },
    requester,
  });

  assert.equal(res.status, 'Active');
  // Format: 'CREATED <currentUser> <YYYY-MM-DD HH:MM AM/PM>' (§2.3)
  assert.ok(
    /^CREATED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/.test(res.stamp),
    `Stamp must match §2.3 specification, got: ${res.stamp}`
  );

  // Check audit_log insert call
  const auditCall = executedSql.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditCall, 'Must insert into audit_log');
  assert.equal(auditCall.params[0], 'admin@hope.com');
  assert.equal(auditCall.params[1], 'C0200');
  const details = JSON.parse(auditCall.params[2]);
  assert.equal(details.custNo, 'C0200');
  assert.equal(details.status, 'Active');
});

// ==============================================================================
// 3. PUT /api/customers/:custNo — Edit Customer (§3.3, §3.8, S2-DEV-02)
// ==============================================================================

test('updateCustomer rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => customerService.updateCustomer({ custNo: 'C0001', data: { custName: 'New Name' }, requester: null }),
    (err) => err.status === 401
  );
});

test('updateCustomer rejects standard User without customer.edit right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.updateCustomer({
        custNo: 'C0001',
        data: { custName: 'New Name' },
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'customer.edit'")
  );
});

test('updateCustomer returns 404 if customer does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.updateCustomer({
        custNo: 'NONEXISTENT',
        data: { custName: 'Updated' },
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('Customer not found')
  );
});

test('updateCustomer validates payment terms on edit', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Old Corp', payTerms: 'Net 30', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.updateCustomer({
        custNo: 'C0001',
        data: { payTerms: 'Invalid Terms' },
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('Invalid payment terms')
  );
});

test('updateCustomer updates record with EDITED stamp and logs to audit_log (§2.3)', async () => {
  const executedSql = [];
  queryHandler = async (sql, params) => {
    executedSql.push({ sql, params });
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Old Corp', address: '123 Old', payTerms: 'Net 30', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  const requester = { role: 'Superadmin', email: 'super@hope.com' };
  const updated = await customerService.updateCustomer({
    custNo: 'C0001',
    data: { custName: 'New Corp', address: '456 New St', payTerms: 'Net 45' },
    requester,
  });

  assert.equal(updated.custNo, 'C0001');
  assert.equal(updated.custName, 'New Corp');
  assert.equal(updated.payTerms, 'Net 45');
  assert.ok(
    /^EDITED super@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/.test(updated.stamp),
    `Stamp must match §2.3 specification, got: ${updated.stamp}`
  );

  // Check audit_log insert call
  const auditCall = executedSql.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditCall, 'Must insert into audit_log');
  assert.equal(auditCall.params[0], 'super@hope.com');
  assert.equal(auditCall.params[1], 'C0001');
  const details = JSON.parse(auditCall.params[2]);
  assert.equal(details.before.custName, 'Old Corp');
  assert.equal(details.after.custName, 'New Corp');
});

// ==============================================================================
// 4. HTTP Integration via Express App (POST & PUT /api/customers) (S2-DEV-02)
// ==============================================================================

test('HTTP POST and PUT /api/customers enforce authentication, permissions, validation, and stamps', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      // If query is for module access check (LIKE 'customer.%')
      if (sql.includes("LIKE 'customer.%'")) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      // User #5 has customer.add but NOT customer.edit
      if (params && params[1] === 'customer.add') {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT 1 FROM CUSTOMER WHERE custNo')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', address: '123 Main', payTerms: 'Net 30', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  try {
    // 1. Unauthenticated POST -> 401
    const unauthPost = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custNo: 'C0099', custName: 'Test', payTerms: 'Net 30' }),
    });
    assert.equal(unauthPost.status, 401);

    // 2. User with customer.add -> POST 201 Created
    const userPost = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '5',
        'x-user-email': 'user@hope.com',
      },
      body: JSON.stringify({ custNo: 'C0099', custName: 'Test Corp', payTerms: 'Net 30' }),
    });
    assert.equal(userPost.status, 201);
    const postBody = await userPost.json();
    assert.equal(postBody.custNo, 'C0099');
    assert.ok(postBody.stamp.startsWith('CREATED user@hope.com'));

    // 3. User attempting PUT without customer.edit -> 403 Forbidden
    const userPut = await fetch(`${baseUrl}/api/customers/C0001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '5',
        'x-user-email': 'user@hope.com',
      },
      body: JSON.stringify({ custName: 'Updated Corp', payTerms: 'Net 45' }),
    });
    assert.equal(userPut.status, 403);

    // 4. Admin attempting PUT -> 200 OK
    const adminPut = await fetch(`${baseUrl}/api/customers/C0001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
      body: JSON.stringify({ custName: 'Admin Updated Corp', payTerms: 'Net 45' }),
    });
    assert.equal(adminPut.status, 200);
    const putBody = await adminPut.json();
    assert.equal(putBody.custName, 'Admin Updated Corp');
    assert.ok(putBody.stamp.startsWith('EDITED admin@hope.com'));
  } finally {
    server.close();
  }
});
