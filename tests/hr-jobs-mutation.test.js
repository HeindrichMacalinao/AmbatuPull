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
// 1. POST /api/hr/jobs — Create Job (§2.3, §3.5, §3.8, S3-DEV-02)
// ==============================================================================

test('createJob rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => hrService.createJob({ data: { jobCode: 'DEV1', jobDesc: 'Developer 1' }, requester: null }),
    (err) => err.status === 401
  );
});

test('createJob rejects standard User without job.add right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      hrService.createJob({
        data: { jobCode: 'DEV1', jobDesc: 'Developer 1' },
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'job.add'")
  );
});

test('createJob validates required fields and length limits', async () => {
  await assert.rejects(
    () =>
      hrService.createJob({
        data: { jobCode: '', jobDesc: 'Developer' },
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400
  );

  await assert.rejects(
    () =>
      hrService.createJob({
        data: { jobCode: 'TOOLONGCODE1', jobDesc: 'Developer' },
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('10 characters')
  );
});

test('createJob rejects duplicate jobCode with 409 Conflict', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM JOB WHERE jobCode = $1')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      hrService.createJob({
        data: { jobCode: 'PRES', jobDesc: 'President' },
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 409 && err.message.includes('already exists')
  );
});

test('createJob inserts Active job with CREATED stamp and logs to audit_log', async () => {
  let insertParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM JOB WHERE jobCode = $1')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO JOB')) {
      insertParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const job = await hrService.createJob({
    data: { jobCode: 'DEV1', jobDesc: 'Developer 1' },
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(job.jobCode, 'DEV1');
  assert.equal(job.jobDesc, 'Developer 1');
  assert.equal(job.status, 'Active');
  assert.match(job.stamp, /^CREATED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
  assert.deepEqual(insertParams, ['DEV1', 'Developer 1', job.stamp]);
  assert.ok(auditParams);
  assert.equal(auditParams[1], 'DEV1');
});

// ==============================================================================
// 2. PUT /api/hr/jobs/:jobCode — Edit Job (§2.3, §3.5, §3.8, S3-DEV-02)
// ==============================================================================

test('updateJob rejects standard User without job.edit right with 403', async () => {
  queryHandler = async () => ({ rows: [], rowCount: 0 });

  await assert.rejects(
    () =>
      hrService.updateJob({
        jobCode: 'DEV1',
        data: { jobDesc: 'Senior Developer' },
        requester: { userId: 5, role: 'User' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'job.edit'")
  );
});

test('updateJob returns 404 when job does not exist', async () => {
  queryHandler = async () => ({ rows: [], rowCount: 0 });

  await assert.rejects(
    () =>
      hrService.updateJob({
        jobCode: 'NONE',
        data: { jobDesc: 'Missing' },
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 404
  );
});

test('updateJob updates jobDesc with EDITED stamp and logs to audit_log', async () => {
  let updateParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM JOB WHERE jobCode = $1')) {
      return {
        rows: [{ jobCode: 'DEV1', jobDesc: 'Developer 1', status: 'Active', stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE JOB')) {
      updateParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const updated = await hrService.updateJob({
    jobCode: 'DEV1',
    data: { jobDesc: 'Senior Developer' },
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  assert.equal(updated.jobDesc, 'Senior Developer');
  assert.match(updated.stamp, /^EDITED super@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
  assert.deepEqual(updateParams, ['Senior Developer', updated.stamp, 'DEV1']);
  assert.ok(auditParams);
});

// ==============================================================================
// 3. DELETE /api/hr/jobs/:jobCode — Soft Delete & Child Dependency (S3-DEV-02)
// ==============================================================================

test('softDeleteJob rejects standard User without job.delete right with 403', async () => {
  queryHandler = async () => ({ rows: [], rowCount: 0 });

  await assert.rejects(
    () =>
      hrService.softDeleteJob({
        jobCode: 'DEV1',
        requester: { userId: 5, role: 'User' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'job.delete'")
  );
});

test('softDeleteJob prevents deletion with 409 if active JOBHISTORY records reference the job', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM JOB WHERE jobCode = $1')) {
      return {
        rows: [{ jobCode: 'PR1', jobDesc: 'Programmer 1', status: 'Active', stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM JOBHISTORY WHERE jobCode = $1')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      hrService.softDeleteJob({
        jobCode: 'PR1',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 409 && err.message.includes('active job history')
  );
});

test('softDeleteJob sets status Inactive with DELETED stamp and logs to audit_log when no active JOBHISTORY exists', async () => {
  let updateParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM JOB WHERE jobCode = $1')) {
      return {
        rows: [{ jobCode: 'DEV1', jobDesc: 'Developer 1', status: 'Active', stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM JOBHISTORY WHERE jobCode = $1')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('UPDATE JOB')) {
      updateParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const deleted = await hrService.softDeleteJob({
    jobCode: 'DEV1',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(deleted.status, 'Inactive');
  assert.match(deleted.stamp, /^DELETED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
  assert.deepEqual(updateParams, [deleted.stamp, 'DEV1']);
  assert.ok(auditParams);
});

// ==============================================================================
// 4. POST /api/hr/jobs/:jobCode/restore — Admin Restore (S3-DEV-02)
// ==============================================================================

test('restoreJob strictly rejects standard User with 403', async () => {
  await assert.rejects(
    () =>
      hrService.restoreJob({
        jobCode: 'DEV1',
        requester: { userId: 5, role: 'User', rights: ['*'] },
      }),
    (err) => err.status === 403 && err.message.includes('only Admin or Superadmin')
  );
});

test('restoreJob restores Inactive job to Active with EDITED stamp and logs to audit_log', async () => {
  let updateParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM JOB WHERE jobCode = $1')) {
      return {
        rows: [{ jobCode: 'DEV1', jobDesc: 'Developer 1', status: 'Inactive', stamp: 'DELETED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE JOB')) {
      updateParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const restored = await hrService.restoreJob({
    jobCode: 'DEV1',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(restored.status, 'Active');
  assert.match(restored.stamp, /^EDITED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
  assert.deepEqual(updateParams, [restored.stamp, 'DEV1']);
  assert.ok(auditParams);
});

// ==============================================================================
// 5. Express HTTP Integration Tests
// ==============================================================================

test('HTTP POST, PUT, DELETE, and POST /restore on /api/hr/jobs enforce auth, RBAC, and stamps', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/hr/jobs`;

  let jobStatus = 'Active';

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission') && sql.includes('rightCode = $2')) {
      const userId = Number(params[0]);
      if (userId === 10) return { rows: [{ 1: 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT 1 FROM JOB WHERE jobCode = $1')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT * FROM JOB WHERE jobCode = $1')) {
      return {
        rows: [{ jobCode: 'QA1', jobDesc: 'QA Analyst', status: jobStatus, stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM JOBHISTORY')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO') || sql.includes('UPDATE JOB')) {
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. User without job.add -> 403
    const noRightPost = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'User', 'x-user-id': '99' },
      body: JSON.stringify({ jobCode: 'QA1', jobDesc: 'QA Analyst' }),
    });
    assert.equal(noRightPost.status, 403);

    // 2. User with job.add -> 201 + CREATED stamp
    const userPost = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '10',
        'x-user-email': 'hr@hope.com',
      },
      body: JSON.stringify({ jobCode: 'QA1', jobDesc: 'QA Analyst' }),
    });
    assert.equal(userPost.status, 201);
    const postBody = await userPost.json();
    assert.match(postBody.job.stamp, /^CREATED hr@hope\.com/);

    // 3. Admin PUT -> 200 + EDITED stamp
    const adminPut = await fetch(`${baseUrl}/QA1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.com' },
      body: JSON.stringify({ jobDesc: 'Lead QA Analyst' }),
    });
    assert.equal(adminPut.status, 200);
    const putBody = await adminPut.json();
    assert.match(putBody.job.stamp, /^EDITED admin@hope\.com/);

    // 4. Admin DELETE -> 200 + Inactive + DELETED stamp
    const adminDel = await fetch(`${baseUrl}/QA1`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.com' },
    });
    assert.equal(adminDel.status, 200);
    const delBody = await adminDel.json();
    assert.equal(delBody.job.status, 'Inactive');
    assert.match(delBody.job.stamp, /^DELETED admin@hope\.com/);

    // 5. User POST /restore -> 403
    jobStatus = 'Inactive';
    const userRestore = await fetch(`${baseUrl}/QA1/restore`, {
      method: 'POST',
      headers: { 'x-user-role': 'User', 'x-user-id': '10' },
    });
    assert.equal(userRestore.status, 403);

    // 6. Admin POST /restore -> 200 + Active + EDITED stamp
    const adminRestore = await fetch(`${baseUrl}/QA1/restore`, {
      method: 'POST',
      headers: { 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.com' },
    });
    assert.equal(adminRestore.status, 200);
    const restoreBody = await adminRestore.json();
    assert.equal(restoreBody.job.status, 'Active');
    assert.match(restoreBody.job.stamp, /^EDITED admin@hope\.com/);
  } finally {
    server.close();
  }
});
