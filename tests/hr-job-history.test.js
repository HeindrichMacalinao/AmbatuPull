'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dbPool = require('../src/db/pool');
const hrService = require('../src/services/hrService');
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

test('listJobHistory orders by effDate DESC, joins JOB & DEPARTMENT, and masks User status/stamp', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM EMPLOYEE')) {
        return { rows: [{ empNo: 'E-001' }] };
      }
      if (sql.includes('FROM JOBHISTORY jh')) {
        assert.ok(sql.includes('ORDER BY jh.effDate DESC'));
        return {
          rows: [
            {
              empNo: 'E-001',
              jobCode: 'DEV2',
              jobDesc: 'Senior Developer',
              effDate: '2025-01-01',
              salary: 65000,
              deptCode: 'IT',
              deptName: 'Information Tech',
              status: 'Active',
              stamp: 'CREATED admin 2025-01-01 09:00 AM',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const result = await hrService.listJobHistory({
    empNo: 'E-001',
    requester: { userId: 10, role: 'User', rights: ['jobhistory.view'] },
  });

  assert.equal(result.total, 1);
  assert.equal(result.history[0].jobDesc, 'Senior Developer');
  assert.equal(result.history[0].deptName, 'Information Tech');
  assert.equal(result.history[0].status, undefined);
  assert.equal(result.history[0].stamp, undefined);
});

test('createJobHistory enforces active FK (JOB/DEPARTMENT), positive salary, and composite PK uniqueness (409)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  let duplicate = false;
  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM EMPLOYEE')) return { rows: [{ empNo: 'E-001' }] };
      if (sql.includes('FROM JOB WHERE')) return { rows: [{ jobCode: 'DEV', status: 'Active' }] };
      if (sql.includes('FROM DEPARTMENT WHERE')) return { rows: [{ deptCode: 'IT', status: 'Active' }] };
      if (sql.includes('SELECT 1 FROM JOBHISTORY')) return duplicate ? { rows: [{ '?column?': 1 }] } : { rows: [] };
      return { rows: [] };
    },
  });

  const admin = { userId: 1, role: 'Admin', email: 'admin@hope.local' };

  await assert.rejects(
    () =>
      hrService.createJobHistory({
        empNo: 'E-001',
        data: { jobCode: 'DEV', deptCode: 'IT', effDate: '2025-01-01', salary: -100 },
        requester: admin,
      }),
    (err) => err.status === 400
  );

  duplicate = true;
  await assert.rejects(
    () =>
      hrService.createJobHistory({
        empNo: 'E-001',
        data: { jobCode: 'DEV', deptCode: 'IT', effDate: '2025-01-01', salary: 50000 },
        requester: admin,
      }),
    (err) => err.status === 409
  );
});

test('createJobHistory, updateJobHistory, softDeleteJobHistory, restoreJobHistory lifecycle', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  let status = 'Active';
  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM EMPLOYEE')) return { rows: [{ empNo: 'E-001' }] };
      if (sql.includes('FROM JOB WHERE')) return { rows: [{ jobCode: 'DEV', status: 'Active' }] };
      if (sql.includes('FROM DEPARTMENT WHERE')) return { rows: [{ deptCode: 'IT', status: 'Active' }] };
      if (sql.includes('SELECT 1 FROM JOBHISTORY')) return { rows: [] };
      if (sql.includes('SELECT * FROM JOBHISTORY')) {
        return { rows: [{ empNo: 'E-001', jobCode: 'DEV', effDate: '2025-01-01', salary: 50000, deptCode: 'IT', status }] };
      }
      return { rows: [] };
    },
  });

  const admin = { userId: 1, role: 'Admin', email: 'admin@hope.local' };

  const created = await hrService.createJobHistory({
    empNo: 'E-001',
    data: { jobCode: 'DEV', deptCode: 'IT', effDate: '2025-01-01', salary: 50000 },
    requester: admin,
  });
  assert.equal(created.status, 'Active');
  assert.match(created.stamp, /^CREATED admin@hope\.local /);

  const updated = await hrService.updateJobHistory({
    empNo: 'E-001',
    jobCode: 'DEV',
    effDate: '2025-01-01',
    data: { deptCode: 'IT', salary: 55000 },
    requester: admin,
  });
  assert.equal(updated.salary, 55000);
  assert.match(updated.stamp, /^EDITED admin@hope\.local /);

  const deleted = await hrService.softDeleteJobHistory({
    empNo: 'E-001',
    jobCode: 'DEV',
    effDate: '2025-01-01',
    requester: admin,
  });
  assert.equal(deleted.status, 'Inactive');
  assert.match(deleted.stamp, /^DELETED admin@hope\.local /);

  status = 'Inactive';
  const restored = await hrService.restoreJobHistory({
    empNo: 'E-001',
    jobCode: 'DEV',
    effDate: '2025-01-01',
    requester: admin,
  });
  assert.equal(restored.status, 'Active');
  assert.match(restored.stamp, /^EDITED admin@hope\.local /);
});

test('Express HTTP integration: /api/hr/employees/:empNo/history', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM EMPLOYEE')) return { rows: [{ empNo: 'E-001' }] };
      if (sql.includes('FROM JOB WHERE')) return { rows: [{ jobCode: 'DEV', status: 'Active' }] };
      if (sql.includes('FROM DEPARTMENT WHERE')) return { rows: [{ deptCode: 'IT', status: 'Active' }] };
      if (sql.includes('SELECT 1 FROM JOBHISTORY')) return { rows: [] };
      if (sql.includes('GROUP BY status')) return { rows: [{ status: 'Active', count: 1 }] };
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
  const adminHeaders = { 'x-user-id': '1', 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.local' };

  const getRes = await requestApp(app, {
    method: 'GET',
    path: '/api/hr/employees/E-001/history',
    headers: adminHeaders,
  });
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.total, 1);

  const postRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/employees/E-001/history',
    headers: adminHeaders,
    body: { jobCode: 'DEV', deptCode: 'IT', effDate: '2025-01-01', salary: 50000 },
  });
  assert.equal(postRes.status, 201);
  assert.equal(postRes.body.jobCode, 'DEV');
});
