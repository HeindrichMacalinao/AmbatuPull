'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const hrService = require('../src/services/hrService');
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
// 1. Service Unit Tests: listJobs (§1.2, §3.5 Figures 18 & 21, S3-DEV-01)
// ==============================================================================

test('listJobs rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => hrService.listJobs({ requester: null }),
    (err) => err.status === 401
  );
});

test('listJobs rejects standard User without HR rights with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      hrService.listJobs({
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('Human Resources module access required')
  );
});

test('listJobs allows Superadmin and Admin automatically without querying user_permission and returns counts', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      throw new Error('user_permission should not be queried for Admin/Superadmin');
    }
    if (sql.includes('GROUP BY status')) {
      return {
        rows: [
          { status: 'Active', count: 12 },
          { status: 'Inactive', count: 2 },
        ],
        rowCount: 2,
      };
    }
    if (sql.includes('FROM JOB')) {
      return {
        rows: [
          {
            jobCode: 'ACCT',
            jobDesc: 'Accountant',
            status: 'Active',
            stamp: 'CREATED admin@hope.com 2026-11-26 10:00 AM',
          },
          {
            jobCode: 'PRES',
            jobDesc: 'President',
            status: 'Active',
            stamp: 'ADD historical_import 2026-10-28',
          },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await hrService.listJobs({
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(result.jobs.length, 2);
  assert.equal(result.total, 2);
  assert.equal(result.jobs[0].jobCode, 'ACCT');
  assert.equal(result.jobs[0].status, 'Active');
  assert.equal(result.jobs[0].stamp, 'CREATED admin@hope.com 2026-11-26 10:00 AM');
  assert.deepEqual(result.counts, { active: 12, inactive: 2, all: 14 });
});

test('listJobs allows standard User when at least one HR right is granted', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM JOB')) {
      return {
        rows: [
          {
            jobCode: 'PR1',
            jobDesc: 'Programmer 1',
            status: 'Active',
            stamp: 'ADD historical_import 2026-10-28',
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await hrService.listJobs({
    requester: { userId: 8, role: 'User', email: 'hruser@hope.com' },
  });

  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].jobCode, 'PR1');
  assert.equal(result.jobs[0].jobDesc, 'Programmer 1');
});

test('Role Visibility: User strictly receives Active jobs and status/stamp/counts are omitted', async () => {
  let capturedSql = '';
  queryHandler = async (sql) => {
    if (sql.includes('FROM JOB')) {
      capturedSql = sql;
      return {
        rows: [
          {
            jobCode: 'HRS',
            jobDesc: 'HR Specialist',
            status: 'Active',
            stamp: 'ADD historical_import 2026-10-28',
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await hrService.listJobs({
    requester: { userId: 8, role: 'User', rights: ['emp.add'] },
    status: 'all', // Should be ignored for standard User
  });

  assert.ok(capturedSql.includes("status = 'Active'"), 'User query must force status = Active');
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].status, undefined, 'status must be omitted for User');
  assert.equal(result.jobs[0].stamp, undefined, 'stamp must be omitted for User');
  assert.equal(result.counts, undefined, 'counts must be omitted for User');
});

test('Role Visibility: Admin supports status=Inactive and status=All filters', async () => {
  const capturedQueries = [];
  queryHandler = async (sql) => {
    if (sql.includes('GROUP BY status')) {
      return {
        rows: [
          { status: 'Active', count: 13 },
          { status: 'Inactive', count: 1 },
        ],
        rowCount: 2,
      };
    }
    if (sql.includes('FROM JOB')) {
      capturedQueries.push(sql);
      return {
        rows: [
          {
            jobCode: 'OLD',
            jobDesc: 'Legacy Role',
            status: 'Inactive',
            stamp: 'DELETED admin@hope.com 2026-11-26 11:00 AM',
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const inactiveRes = await hrService.listJobs({
    requester: { role: 'Superadmin' },
    status: 'Inactive',
  });
  assert.ok(capturedQueries[0].includes("status = 'Inactive'"));
  assert.equal(inactiveRes.jobs[0].status, 'Inactive');
  assert.deepEqual(inactiveRes.counts, { active: 13, inactive: 1, all: 14 });

  await hrService.listJobs({
    requester: { role: 'Admin' },
    status: 'All',
  });
  assert.ok(!capturedQueries[1].includes("status = 'Active'") && !capturedQueries[1].includes("status = 'Inactive'"));
});

test('Live Search: filters matching jobCode or jobDesc (case-insensitive)', async () => {
  let capturedSql = '';
  let capturedParams = [];
  queryHandler = async (sql, params) => {
    if (sql.includes('GROUP BY status')) {
      return { rows: [{ status: 'Active', count: 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM JOB')) {
      capturedSql = sql;
      capturedParams = params;
      return {
        rows: [
          {
            jobCode: 'PR1',
            jobDesc: 'Programmer 1',
            status: 'Active',
            stamp: 'ADD historical_import 2026-10-28',
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const result = await hrService.listJobs({
    requester: { role: 'Admin' },
    search: '  Prog  ',
  });

  assert.ok(capturedSql.includes('LOWER(jobCode) LIKE $1 OR LOWER(jobDesc) LIKE $1'));
  assert.deepEqual(capturedParams, ['%prog%']);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].jobCode, 'PR1');
});

// ==============================================================================
// 2. Express HTTP Integration Tests for GET /api/hr/jobs and GET /api/jobs
// ==============================================================================

test('HTTP GET /api/hr/jobs and /api/jobs enforce auth, RBAC, status tabs, search, counts, and visibility', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const hrUrl = `http://127.0.0.1:${port}/api/hr/jobs`;
  const aliasUrl = `http://127.0.0.1:${port}/api/jobs`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      const userId = Number(params[0]);
      if (userId === 10) return { rows: [{ 1: 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('GROUP BY status')) {
      return {
        rows: [
          { status: 'Active', count: 10 },
          { status: 'Inactive', count: 2 },
        ],
        rowCount: 2,
      };
    }
    if (sql.includes('FROM JOB')) {
      return {
        rows: [
          {
            jobCode: 'ANYS',
            jobDesc: 'Analyst',
            status: 'Active',
            stamp: 'ADD historical_import 2026-10-28',
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Unauthenticated -> 401
    const unauth = await fetch(hrUrl);
    assert.equal(unauth.status, 401);

    // 2. User without HR rights -> 403
    const forbidden = await fetch(hrUrl, {
      headers: { 'x-user-role': 'User', 'x-user-id': '99' },
    });
    assert.equal(forbidden.status, 403);

    // 3. User with HR rights -> 200 Active only, no status/stamp/counts
    const userRes = await fetch(`${hrUrl}?status=all&search=anys`, {
      headers: { 'x-user-role': 'User', 'x-user-id': '10' },
    });
    assert.equal(userRes.status, 200);
    const userBody = await userRes.json();
    assert.equal(userBody.jobs.length, 1);
    assert.equal(userBody.jobs[0].jobCode, 'ANYS');
    assert.equal(userBody.jobs[0].status, undefined);
    assert.equal(userBody.jobs[0].stamp, undefined);
    assert.equal(userBody.counts, undefined);

    // 4. Admin via /api/hr/jobs -> 200 with status, stamp, and counts
    const adminRes = await fetch(`${hrUrl}?status=All`, {
      headers: { 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.com' },
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.jobs[0].status, 'Active');
    assert.equal(adminBody.jobs[0].stamp, 'ADD historical_import 2026-10-28');
    assert.deepEqual(adminBody.counts, { active: 10, inactive: 2, all: 12 });

    // 5. Alias /api/jobs -> 200
    const aliasRes = await fetch(aliasUrl, {
      headers: { 'x-user-role': 'Superadmin', 'x-user-email': 'super@hope.com' },
    });
    assert.equal(aliasRes.status, 200);
    const aliasBody = await aliasRes.json();
    assert.equal(aliasBody.jobs.length, 1);
    assert.deepEqual(aliasBody.counts, { active: 10, inactive: 2, all: 12 });
  } finally {
    server.close();
  }
});
