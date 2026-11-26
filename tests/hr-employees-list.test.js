'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dbPool = require('../src/db/pool');
const hrService = require('../src/services/hrService');
const { createApp } = require('../src/expressApp');

function requestApp(app, { method = 'GET', path, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

test('listEmployees rejects unauthenticated (401) and User without HR rights (403)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({ query: async () => ({ rows: [] }) });

  await assert.rejects(
    () => hrService.listEmployees({ requester: null }),
    (err) => err.status === 401
  );

  await assert.rejects(
    () => hrService.listEmployees({ requester: { userId: 5, role: 'User', rights: ['customer.add'] } }),
    (err) => err.status === 403
  );
});

test('listEmployees forces Active and strips status/stamp for User role', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM EMPLOYEE')) {
        assert.ok(sql.includes("status = 'Active'"));
        return {
          rows: [
            {
              empNo: 'E-001',
              lastName: 'Santos',
              firstName: 'Juan',
              gender: 'M',
              birthDate: '1990-01-15',
              hireDate: '2020-05-01',
              sepDate: null,
              status: 'Active',
              stamp: 'CREATED admin 2026-01-01 09:00 AM',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const result = await hrService.listEmployees({
    requester: { userId: 10, role: 'User', rights: ['emp.view'] },
    status: 'All',
  });

  assert.equal(result.total, 1);
  assert.equal(result.counts, undefined);
  assert.equal(result.employees[0].status, undefined);
  assert.equal(result.employees[0].stamp, undefined);
  assert.equal(result.employees[0].sepDate, null);
});

test('listEmployees returns Inactive/All employees, status/stamp, sepDate, and counts for Admin', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('GROUP BY status')) {
        return {
          rows: [
            { status: 'Active', count: 3 },
            { status: 'Inactive', count: 1 },
          ],
        };
      }
      if (sql.includes('FROM EMPLOYEE')) {
        return {
          rows: [
            {
              empNo: 'E-004',
              lastName: 'Garcia',
              firstName: 'Maria',
              gender: 'F',
              birthDate: '1988-03-20',
              hireDate: '2018-02-01',
              sepDate: '2025-12-31',
              status: 'Inactive',
              stamp: 'DELETED admin 2026-01-02 10:00 AM',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const result = await hrService.listEmployees({
    requester: { userId: 1, role: 'Admin' },
    status: 'All',
  });

  assert.equal(result.total, 1);
  assert.equal(result.employees[0].empNo, 'E-004');
  assert.equal(result.employees[0].sepDate, '2025-12-31');
  assert.equal(result.employees[0].status, 'Inactive');
  assert.ok(result.employees[0].stamp);
  assert.deepEqual(result.counts, { active: 3, inactive: 1, all: 4 });
});

test('listEmployees applies search filter across empNo, lastName, and firstName', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  let capturedSql = '';
  let capturedParams = [];
  dbPool.getPool = () => ({
    query: async (sql, params = []) => {
      if (sql.includes('FROM EMPLOYEE') && !sql.includes('GROUP BY')) {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  await hrService.listEmployees({
    requester: { userId: 1, role: 'Admin' },
    search: 'Garcia',
  });

  assert.ok(capturedSql.includes('LOWER(empNo) LIKE'));
  assert.ok(capturedSql.includes('LOWER(lastName) LIKE'));
  assert.ok(capturedSql.includes('LOWER(firstName) LIKE'));
  assert.deepEqual(capturedParams, ['%garcia%']);
});

test('Express HTTP integration: GET /api/hr/employees', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('GROUP BY status')) {
        return { rows: [{ status: 'Active', count: 1 }] };
      }
      if (sql.includes('FROM EMPLOYEE')) {
        return {
          rows: [
            {
              empNo: 'E-001',
              lastName: 'Santos',
              firstName: 'Juan',
              gender: 'M',
              birthDate: '1990-01-15',
              hireDate: '2020-05-01',
              sepDate: null,
              status: 'Active',
              stamp: 'CREATED admin 2026-01-01 09:00 AM',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const app = createApp();

  const unauthRes = await requestApp(app, { method: 'GET', path: '/api/hr/employees' });
  assert.equal(unauthRes.status, 401);

  const adminRes = await requestApp(app, {
    method: 'GET',
    path: '/api/hr/employees?status=Active',
    headers: { 'x-user-id': '1', 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.local' },
  });
  assert.equal(adminRes.status, 200);
  assert.equal(adminRes.body.total, 1);
  assert.equal(adminRes.body.employees[0].empNo, 'E-001');
  assert.deepEqual(adminRes.body.counts, { active: 1, inactive: 0, all: 1 });
});
