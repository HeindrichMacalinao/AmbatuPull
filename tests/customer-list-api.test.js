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

// Sample database rows
const sampleDbRows = [
  {
    custNo: 'C0001',
    custName: 'Globus Medical, Inc',
    address: '2560 Gen Armistead Ave Audubon CA 94031',
    payTerms: '30D',
    status: 'Active',
    stamp: 'ADD historical_import 2026-10-28',
  },
  {
    custNo: 'C0002',
    custName: 'RF Industries, Inc',
    address: '7610 Miramar Rd San Diego, CA 92602',
    payTerms: '45D',
    status: 'Active',
    stamp: 'ADD historical_import 2026-10-28',
  },
  {
    custNo: 'C0003',
    custName: 'Trisha Macdowell',
    address: '7642 Clairemont Mesa Blvd San Diego CA 90321',
    payTerms: 'COD',
    status: 'Inactive',
    stamp: 'SOFT_DELETE admin@hope.com 2026-11-01',
  },
];

// ==============================================================================
// 1. Authorization Middleware & Permission Checks (§4.2, S2-DEV-01)
// ==============================================================================

test('listCustomers rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => customerService.listCustomers({ requester: null }),
    (err) => err.status === 401
  );
});

test('listCustomers rejects standard User without customer rights with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.listCustomers({
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('customer module access required')
  );
});

test('listCustomers allows Superadmin and Admin automatically without querying user_permission', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM CUSTOMER')) {
      return { rows: sampleDbRows.filter((r) => r.status === 'Active'), rowCount: 2 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminList = await customerService.listCustomers({
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminList.length, 2);

  const superList = await customerService.listCustomers({
    requester: { userId: 2, role: 'Superadmin', email: 'super@hope.com' },
  });
  assert.equal(superList.length, 2);

  // Verify that user_permission was not queried
  assert.ok(
    !mockQueries.some((q) => q.sql.includes('user_permission')),
    'Admin/Superadmin must bypass user_permission check'
  );
});

test('listCustomers allows standard User when customer right is granted', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM CUSTOMER')) {
      return { rows: [sampleDbRows[0]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const customers = await customerService.listCustomers({
    requester: { userId: 7, role: 'User', email: 'user@hope.com' },
  });
  assert.equal(customers.length, 1);
});

// ==============================================================================
// 2. Server-Side Role Visibility Rules (§1.2, §3.3 Figures 9-10, §4.2)
// ==============================================================================

test('Role Visibility: User strictly receives Active customers and status/stamp fields are omitted', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM CUSTOMER')) {
      // Must enforce WHERE status = 'Active' in SQL
      assert.ok(sql.includes("status = 'Active'"), 'User query must enforce status = Active in SQL');
      return { rows: [sampleDbRows[0]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const customers = await customerService.listCustomers({
    requester: { userId: 7, role: 'User', email: 'user@hope.com' },
  });

  assert.equal(customers.length, 1);
  const cust = customers[0];
  assert.equal(cust.custNo, 'C0001');
  assert.equal(cust.custName, 'Globus Medical, Inc');
  assert.equal(cust.address, '2560 Gen Armistead Ave Audubon CA 94031');
  assert.equal(cust.payTerms, '30D');

  // Verify that status and stamp are completely omitted from User payload (Figure 10)
  assert.equal('status' in cust, false, 'status field must be omitted for User');
  assert.equal('stamp' in cust, false, 'stamp field must be omitted for User');
});

test('Role Visibility: User ignores status=all or status=inactive parameters', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM CUSTOMER')) {
      assert.ok(sql.includes("status = 'Active'"), 'User query must strictly enforce Active status');
      assert.ok(!sql.includes("status = 'Inactive'"), 'User query must never request Inactive status');
      return { rows: [sampleDbRows[0]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  // User passing status=inactive
  await customerService.listCustomers({
    requester: { userId: 7, role: 'User', email: 'user@hope.com' },
    status: 'inactive',
  });

  // User passing status=all
  await customerService.listCustomers({
    requester: { userId: 7, role: 'User', email: 'user@hope.com' },
    status: 'all',
  });
});

test('Role Visibility: Admin receives active, inactive, or all customers with status and stamp', async () => {
  // 1. Default (Active)
  queryHandler = async (sql) => {
    if (sql.includes('FROM CUSTOMER')) {
      assert.ok(sql.includes("status = 'Active'"));
      return { rows: sampleDbRows.filter((r) => r.status === 'Active'), rowCount: 2 };
    }
    return { rows: [], rowCount: 0 };
  };

  const activeRes = await customerService.listCustomers({
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(activeRes.length, 2);
  assert.ok(activeRes[0].status === 'Active');
  assert.ok(activeRes[0].stamp);

  // 2. Inactive status tab (Figure 9 #1)
  queryHandler = async (sql) => {
    if (sql.includes('FROM CUSTOMER')) {
      assert.ok(sql.includes("status = 'Inactive'"));
      return { rows: sampleDbRows.filter((r) => r.status === 'Inactive'), rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const inactiveRes = await customerService.listCustomers({
    requester: { role: 'Admin', email: 'admin@hope.com' },
    status: 'inactive',
  });
  assert.equal(inactiveRes.length, 1);
  assert.equal(inactiveRes[0].custNo, 'C0003');
  assert.equal(inactiveRes[0].status, 'Inactive');
  assert.ok(inactiveRes[0].stamp);

  // 3. All status tab
  queryHandler = async (sql) => {
    if (sql.includes('FROM CUSTOMER')) {
      assert.ok(!sql.includes("status = 'Active'"), 'status=all should not filter Active only');
      assert.ok(!sql.includes("status = 'Inactive'"), 'status=all should not filter Inactive only');
      return { rows: sampleDbRows, rowCount: 3 };
    }
    return { rows: [], rowCount: 0 };
  };

  const allRes = await customerService.listCustomers({
    requester: { role: 'Admin', email: 'admin@hope.com' },
    status: 'all',
  });
  assert.equal(allRes.length, 3);
});

// ==============================================================================
// 3. Live Search Filtering (custNo, custName, address)
// ==============================================================================

test('Live Search: filters matching custNo, custName, or address (case-insensitive)', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('FROM CUSTOMER')) {
      assert.ok(
        sql.includes('LOWER(custNo) LIKE') &&
        sql.includes('LOWER(custName) LIKE') &&
        sql.includes('LOWER(address) LIKE'),
        'Query must filter custNo, custName, and address'
      );
      assert.equal(params[0], '%globus%');
      return { rows: [sampleDbRows[0]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const results = await customerService.listCustomers({
    requester: { role: 'Admin', email: 'admin@hope.com' },
    search: 'Globus',
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].custNo, 'C0001');
});

// ==============================================================================
// 4. Single Customer Lookup (GET /api/customers/:custNo)
// ==============================================================================

test('getCustomerByNo returns customer details respecting role visibility', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('FROM CUSTOMER WHERE custNo = $1')) {
      assert.equal(params[0], 'C0001');
      return { rows: [sampleDbRows[0]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  // Admin gets status and stamp
  const adminCust = await customerService.getCustomerByNo({
    custNo: 'C0001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminCust.custNo, 'C0001');
  assert.equal(adminCust.status, 'Active');
  assert.ok(adminCust.stamp);

  // User has status and stamp omitted
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM CUSTOMER WHERE custNo = $1')) {
      assert.equal(params[0], 'C0001');
      assert.ok(sql.includes("status = 'Active'"));
      return { rows: [sampleDbRows[0]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const userCust = await customerService.getCustomerByNo({
    custNo: 'C0001',
    requester: { userId: 5, role: 'User', email: 'user@hope.com' },
  });
  assert.equal(userCust.custNo, 'C0001');
  assert.equal('status' in userCust, false);
  assert.equal('stamp' in userCust, false);
});

// ==============================================================================
// 5. HTTP Integration via Express App (S2-DEV-01)
// ==============================================================================

test('HTTP GET /api/customers enforces auth, permissions, status tabs, search, and visibility', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      if (params[0] === 5) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM CUSTOMER')) {
      if (sql.includes("status = 'Inactive'")) {
        return { rows: [sampleDbRows[2]], rowCount: 1 };
      }
      if (sql.includes("status = 'Active'")) {
        return { rows: [sampleDbRows[0], sampleDbRows[1]], rowCount: 2 };
      }
      return { rows: sampleDbRows, rowCount: 3 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/api/customers`);
    assert.equal(unauthRes.status, 401);

    // 2. User without rights -> 403
    const forbiddenRes = await fetch(`${baseUrl}/api/customers`, {
      headers: { 'x-user-role': 'User', 'x-user-id': '99' },
    });
    assert.equal(forbiddenRes.status, 403);

    // 3. User with customer rights -> 200 with status/stamp omitted
    const userRes = await fetch(`${baseUrl}/api/customers`, {
      headers: { 'x-user-role': 'User', 'x-user-id': '5' },
    });
    assert.equal(userRes.status, 200);
    const userBody = await userRes.json();
    assert.equal(userBody.customers.length, 2);
    assert.equal('status' in userBody.customers[0], false);
    assert.equal('stamp' in userBody.customers[0], false);

    // 4. Admin -> 200 with status and stamp
    const adminRes = await fetch(`${baseUrl}/api/customers`, {
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.customers.length, 2);
    assert.equal(adminBody.customers[0].status, 'Active');
    assert.ok(adminBody.customers[0].stamp);

    // 5. Admin filtering status=inactive
    const inactiveRes = await fetch(`${baseUrl}/api/customers?status=inactive`, {
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(inactiveRes.status, 200);
    const inactiveBody = await inactiveRes.json();
    assert.equal(inactiveBody.customers.length, 1);
    assert.equal(inactiveBody.customers[0].custNo, 'C0003');
    assert.equal(inactiveBody.customers[0].status, 'Inactive');

    // 6. Admin searching
    const searchRes = await fetch(`${baseUrl}/api/customers?search=globus`, {
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(searchRes.status, 200);
  } finally {
    server.close();
  }
});
