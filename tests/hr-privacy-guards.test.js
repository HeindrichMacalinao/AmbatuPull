'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dbPool = require('../src/db/pool');
const { createApp } = require('../src/expressApp');

function requestApp(app, { method = 'GET', path, headers: extraHeaders = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const headers = { ...extraHeaders };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }

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

      if (payload) req.write(payload);
      req.end();
    });
  });
}

test('RA 10173 Salary Privacy: User without jobhistory.view gets 403 on GET /api/hr/employees/:empNo/history', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM user_permission')) return { rows: [] };
      if (sql.includes('FROM EMPLOYEE')) return { rows: [{ empNo: 'E-001' }] };
      if (sql.includes('FROM JOBHISTORY jh')) {
        return {
          rows: [
            {
              empNo: 'E-001',
              jobCode: 'DEV',
              jobDesc: 'Developer',
              effDate: '2025-01-01',
              salary: 50000,
              deptCode: 'IT',
              deptName: 'IT',
              status: 'Active',
              stamp: 'CREATED admin 2025-01-01 09:00 AM',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const app = createApp();

  const noRightRes = await requestApp(app, {
    method: 'GET',
    path: '/api/hr/employees/E-001/history',
    headers: {
      'x-user-id': '5',
      'x-user-role': 'User',
      'x-user-rights': JSON.stringify(['emp.add']),
    },
  });
  assert.equal(noRightRes.status, 403);

  const withRightRes = await requestApp(app, {
    method: 'GET',
    path: '/api/hr/employees/E-001/history',
    headers: {
      'x-user-id': '5',
      'x-user-role': 'User',
      'x-user-rights': JSON.stringify(['jobhistory.view']),
    },
  });
  assert.equal(withRightRes.status, 200);
  assert.equal(withRightRes.body.history[0].salary, 50000);
});

test('13 HR Route Guards: every HR mutation/history route rejects User without exact right (403)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async () => ({ rows: [] }),
  });

  const app = createApp();
  const userWithoutRights = {
    'x-user-id': '99',
    'x-user-role': 'User',
    'x-user-rights': JSON.stringify(['hr.view']),
  };

  const guardedRoutes = [
    { method: 'POST', path: '/api/hr/jobs', body: { jobCode: 'J1', jobDesc: 'Job 1' } },
    { method: 'PUT', path: '/api/hr/jobs/J1', body: { jobDesc: 'Job 1' } },
    { method: 'DELETE', path: '/api/hr/jobs/J1' },
    { method: 'POST', path: '/api/hr/departments', body: { deptCode: 'D1', deptName: 'Dept 1' } },
    { method: 'PUT', path: '/api/hr/departments/D1', body: { deptName: 'Dept 1' } },
    { method: 'DELETE', path: '/api/hr/departments/D1' },
    {
      method: 'POST',
      path: '/api/hr/employees',
      body: { empNo: 'E1', lastName: 'A', firstName: 'B', gender: 'M', birthDate: '1990-01-01', hireDate: '2020-01-01' },
    },
    {
      method: 'PUT',
      path: '/api/hr/employees/E1',
      body: { lastName: 'A', firstName: 'B', gender: 'M', birthDate: '1990-01-01', hireDate: '2020-01-01' },
    },
    { method: 'DELETE', path: '/api/hr/employees/E1' },
    { method: 'GET', path: '/api/hr/employees/E1/history' },
    {
      method: 'POST',
      path: '/api/hr/employees/E1/history',
      body: { jobCode: 'J1', deptCode: 'D1', effDate: '2025-01-01', salary: 50000 },
    },
    {
      method: 'PUT',
      path: '/api/hr/employees/E1/history/J1/2025-01-01',
      body: { deptCode: 'D1', salary: 55000 },
    },
    { method: 'DELETE', path: '/api/hr/employees/E1/history/J1/2025-01-01' },
  ];

  for (const route of guardedRoutes) {
    const res = await requestApp(app, { ...route, headers: userWithoutRights });
    assert.equal(res.status, 403, `Expected 403 for ${route.method} ${route.path}, got ${res.status}`);
  }
});
