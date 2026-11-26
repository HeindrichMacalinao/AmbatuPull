'use strict';

const dbPool = require('../db/pool');

/**
 * Format audit stamp according to §2.3:
 * '<ACTION> <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 */
function formatAuditStamp(action, user, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = pad(hours);
  const actor = user?.email || user?.username || user?.role || 'system';
  return `${action} ${actor} ${yyyy}-${mm}-${dd} ${hh}:${minutes} ${ampm}`;
}

/**
 * Check if the requester is authorized to access the Human Resources module (§4.2 & S3-DEV-01).
 * Superadmin and Admin always have access.
 * Standard User must possess at least one active HR right (emp.*, job.*, dept.*, jobhistory.*, hr.*).
 */
async function assertHrAccess(pool, requester) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'Superadmin' || requester.role === 'Admin') {
    return;
  }

  if (requester.rights && Array.isArray(requester.rights)) {
    const hasHrRight = requester.rights.some(
      (r) =>
        typeof r === 'string' &&
        (r.startsWith('emp.') ||
          r.startsWith('job.') ||
          r.startsWith('dept.') ||
          r.startsWith('jobhistory.') ||
          r.startsWith('hr.') ||
          r === 'hr' ||
          r === '*')
    );
    if (hasHrRight) return;
  }

  const userId = requester.userId ?? requester.userid;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_permission
     WHERE userId = $1
       AND status = 'Active'
       AND (
         rightCode LIKE 'emp.%'
         OR rightCode LIKE 'job.%'
         OR rightCode LIKE 'dept.%'
         OR rightCode LIKE 'jobhistory.%'
         OR rightCode LIKE 'hr.%'
         OR rightCode = 'hr'
       )
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('Forbidden: Human Resources module access required');
    err.status = 403;
    throw err;
  }
}

/**
 * Check if requester has a specific HR right (§4.2 & §3.8).
 */
async function assertHrRight(pool, requester, rightCode) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'Superadmin' || requester.role === 'Admin') {
    return;
  }

  if (requester.rights && Array.isArray(requester.rights)) {
    if (requester.rights.includes(rightCode) || requester.rights.includes('*')) {
      return;
    }
  }

  const userId = requester.userId ?? requester.userid;
  const { rows } = await pool.query(
    "SELECT 1 FROM user_permission WHERE userId = $1 AND rightCode = $2 AND status = 'Active'",
    [userId, rightCode]
  );

  if (rows.length === 0) {
    const err = new Error(`Forbidden: missing required permission '${rightCode}'`);
    err.status = 403;
    throw err;
  }
}

/**
 * GET /api/hr/jobs & GET /api/jobs (§1.2, §3.5 Figures 18 & 21, S3-DEV-01).
 * - Superadmin/Admin: supports status filter ('Active', 'Inactive', 'All'), returns status, stamp, and counts.
 * - User: strictly forced to Active status, omits status and stamp fields.
 * - Live search against jobCode and jobDesc.
 */
async function listJobs({ requester, search, status } = {}) {
  const pool = dbPool.getPool();

  await assertHrAccess(pool, requester);

  const isStandardUser = requester.role === 'User';

  let query = 'SELECT jobCode, jobDesc, status, stamp FROM JOB';
  const whereClauses = [];
  const params = [];

  if (isStandardUser) {
    whereClauses.push("status = 'Active'");
  } else {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'inactive') {
      whereClauses.push("status = 'Inactive'");
    } else if (normalizedStatus === 'all') {
      // No status filter
    } else {
      whereClauses.push("status = 'Active'");
    }
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    whereClauses.push(`(LOWER(jobCode) LIKE $${pIdx} OR LOWER(jobDesc) LIKE $${pIdx})`);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY jobCode ASC';

  const { rows } = await pool.query(query, params);

  const jobs = rows.map((r) => {
    const jobCode = r.jobCode ?? r.jobcode;
    const jobDesc = r.jobDesc ?? r.jobdesc ?? null;

    if (isStandardUser) {
      return {
        jobCode,
        jobDesc,
      };
    }

    return {
      jobCode,
      jobDesc,
      status: r.status,
      stamp: r.stamp,
    };
  });

  if (isStandardUser) {
    return {
      jobs,
      total: jobs.length,
    };
  }

  // Compute Active, Inactive, and All counts for Admin status tabs
  const countRes = await pool.query('SELECT status, COUNT(*) AS count FROM JOB GROUP BY status');
  let activeCount = 0;
  let inactiveCount = 0;
  for (const row of countRes.rows || []) {
    const rowStatus = row.status;
    const cnt = Number(row.count ?? row.cnt ?? 0);
    if (rowStatus === 'Active') activeCount = cnt;
    else if (rowStatus === 'Inactive') inactiveCount = cnt;
  }

  return {
    jobs,
    total: jobs.length,
    counts: {
      active: activeCount,
      inactive: inactiveCount,
      all: activeCount + inactiveCount,
    },
  };
}

/**
 * POST /api/hr/jobs (Create Job) (§2.3, §3.5, §3.8, S3-DEV-02).
 * - Guard: requireRight('job.add')
 * - Validates jobCode (<= 10 chars) and jobDesc (<= 100 chars)
 * - Checks uniqueness of jobCode (409 on duplicate)
 * - Sets status = 'Active', stamp = 'CREATED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function createJob({ data = {}, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'job.add');

  const trimmedCode = typeof data.jobCode === 'string' ? data.jobCode.trim() : '';
  const trimmedDesc = typeof data.jobDesc === 'string' ? data.jobDesc.trim() : '';

  if (!trimmedCode || !trimmedDesc) {
    const err = new Error('Job code and job description are required');
    err.status = 400;
    throw err;
  }

  if (trimmedCode.length > 10) {
    const err = new Error('Job code must not exceed 10 characters');
    err.status = 400;
    throw err;
  }

  if (trimmedDesc.length > 100) {
    const err = new Error('Job description must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const dupRes = await pool.query('SELECT 1 FROM JOB WHERE jobCode = $1', [trimmedCode]);
  if (dupRes.rows.length > 0) {
    const err = new Error(`Job with code '${trimmedCode}' already exists`);
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('CREATED', requester);

  await pool.query(
    `INSERT INTO JOB (jobCode, jobDesc, status, stamp)
     VALUES ($1, $2, 'Active', $3)`,
    [trimmedCode, trimmedDesc, stamp]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'CREATED', 'JOB', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({ jobCode: trimmedCode, jobDesc: trimmedDesc, status: 'Active' }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    jobCode: trimmedCode,
    jobDesc: trimmedDesc,
    status: 'Active',
    stamp,
  };
}

/**
 * PUT /api/hr/jobs/:jobCode (Edit Job) (§2.3, §3.5, §3.8, S3-DEV-02).
 * - Guard: requireRight('job.edit')
 * - Validates jobDesc (<= 100 chars)
 * - Updates stamp = 'EDITED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function updateJob({ jobCode, data = {}, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'job.edit');

  const trimmedCode = typeof jobCode === 'string' ? jobCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Job code is required');
    err.status = 400;
    throw err;
  }

  const trimmedDesc = typeof data.jobDesc === 'string' ? data.jobDesc.trim() : '';
  if (!trimmedDesc) {
    const err = new Error('Job description is required');
    err.status = 400;
    throw err;
  }

  if (trimmedDesc.length > 100) {
    const err = new Error('Job description must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM JOB WHERE jobCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE JOB
     SET jobDesc = $1, stamp = $2
     WHERE jobCode = $3`,
    [trimmedDesc, stamp, trimmedCode]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'JOB', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: { jobDesc: existing.jobDesc ?? existing.jobdesc, status: existing.status },
          after: { jobDesc: trimmedDesc, status: existing.status },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    jobCode: trimmedCode,
    jobDesc: trimmedDesc,
    status: existing.status,
    stamp,
  };
}

/**
 * DELETE /api/hr/jobs/:jobCode (Soft Delete Job) (§2.3, §3.5, §3.8, S3-DEV-02).
 * - Guard: requireRight('job.delete')
 * - Prevents deletion if active JOBHISTORY records reference this job (409)
 * - Soft delete only: sets status = 'Inactive', stamp = 'DELETED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function softDeleteJob({ jobCode, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'job.delete');

  const trimmedCode = typeof jobCode === 'string' ? jobCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Job code is required');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM JOB WHERE jobCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  if (existing.status === 'Inactive') {
    const err = new Error('Job is already inactive');
    err.status = 400;
    throw err;
  }

  // Child-dependency verification: prevent deletion if active job history exists
  const childRes = await pool.query(
    "SELECT 1 FROM JOBHISTORY WHERE jobCode = $1 AND status = 'Active' LIMIT 1",
    [trimmedCode]
  );
  if (childRes.rows.length > 0) {
    const err = new Error('Cannot delete job: active job history records reference this job');
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('DELETED', requester);

  await pool.query(
    `UPDATE JOB
     SET status = 'Inactive', stamp = $1
     WHERE jobCode = $2`,
    [stamp, trimmedCode]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'DELETED', 'JOB', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: { jobDesc: existing.jobDesc ?? existing.jobdesc, status: existing.status },
          after: { status: 'Inactive' },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    jobCode: trimmedCode,
    jobDesc: existing.jobDesc ?? existing.jobdesc,
    status: 'Inactive',
    stamp,
  };
}

/**
 * POST / PUT /api/hr/jobs/:jobCode/restore (Restore Job) (§2.3, §3.5, S3-DEV-02).
 * - Strictly restricted to Admin and Superadmin
 * - Sets status = 'Active', stamp = 'EDITED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function restoreJob({ jobCode, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role !== 'Admin' && requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: only Admin or Superadmin can restore jobs');
    err.status = 403;
    throw err;
  }

  const trimmedCode = typeof jobCode === 'string' ? jobCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Job code is required');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM JOB WHERE jobCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  if (existing.status === 'Active') {
    const err = new Error('Job is already active');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE JOB
     SET status = 'Active', stamp = $1
     WHERE jobCode = $2`,
    [stamp, trimmedCode]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'RESTORED', 'JOB', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: { jobDesc: existing.jobDesc ?? existing.jobdesc, status: existing.status },
          after: { status: 'Active' },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    jobCode: trimmedCode,
    jobDesc: existing.jobDesc ?? existing.jobdesc,
    status: 'Active',
    stamp,
  };
}

/**
 * GET /api/hr/departments (§1.2, §3.5 Figures 19 & 22, S3-DEV-03).
 * - Superadmin/Admin: supports status filter ('Active', 'Inactive', 'All'), returns status, stamp, and counts.
 * - User: strictly forced to Active status, omits status and stamp fields.
 * - Live search against deptCode and deptName.
 */
async function listDepartments({ requester, search, status } = {}) {
  const pool = dbPool.getPool();

  await assertHrAccess(pool, requester);

  const isStandardUser = requester.role === 'User';

  let query = 'SELECT deptCode, deptName, status, stamp FROM DEPARTMENT';
  const whereClauses = [];
  const params = [];

  if (isStandardUser) {
    whereClauses.push("status = 'Active'");
  } else {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'inactive') {
      whereClauses.push("status = 'Inactive'");
    } else if (normalizedStatus === 'all') {
      // No status filter
    } else {
      whereClauses.push("status = 'Active'");
    }
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    whereClauses.push(`(LOWER(deptCode) LIKE $${pIdx} OR LOWER(deptName) LIKE $${pIdx})`);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY deptCode ASC';

  const { rows } = await pool.query(query, params);

  const departments = rows.map((r) => {
    const deptCode = r.deptCode ?? r.deptcode;
    const deptName = r.deptName ?? r.deptname ?? null;

    if (isStandardUser) {
      return {
        deptCode,
        deptName,
      };
    }

    return {
      deptCode,
      deptName,
      status: r.status,
      stamp: r.stamp,
    };
  });

  if (isStandardUser) {
    return {
      departments,
      total: departments.length,
    };
  }

  const countRes = await pool.query('SELECT status, COUNT(*) AS count FROM DEPARTMENT GROUP BY status');
  let activeCount = 0;
  let inactiveCount = 0;
  for (const row of countRes.rows || []) {
    const rowStatus = row.status;
    const cnt = Number(row.count ?? row.cnt ?? 0);
    if (rowStatus === 'Active') activeCount = cnt;
    else if (rowStatus === 'Inactive') inactiveCount = cnt;
  }

  return {
    departments,
    total: departments.length,
    counts: {
      active: activeCount,
      inactive: inactiveCount,
      all: activeCount + inactiveCount,
    },
  };
}

/**
 * POST /api/hr/departments (Create Department) (§2.3, §3.5, §3.8, S3-DEV-03).
 * - Guard: requireRight('dept.add')
 * - Validates deptCode (<= 10 chars) and deptName (<= 100 chars)
 * - Checks uniqueness of deptCode (409 on duplicate)
 * - Sets status = 'Active', stamp = 'CREATED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function createDepartment({ data = {}, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'dept.add');

  const trimmedCode = typeof data.deptCode === 'string' ? data.deptCode.trim() : '';
  const trimmedName = typeof data.deptName === 'string' ? data.deptName.trim() : '';

  if (!trimmedCode || !trimmedName) {
    const err = new Error('Department code and department name are required');
    err.status = 400;
    throw err;
  }

  if (trimmedCode.length > 10) {
    const err = new Error('Department code must not exceed 10 characters');
    err.status = 400;
    throw err;
  }

  if (trimmedName.length > 100) {
    const err = new Error('Department name must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const dupRes = await pool.query('SELECT 1 FROM DEPARTMENT WHERE deptCode = $1', [trimmedCode]);
  if (dupRes.rows.length > 0) {
    const err = new Error(`Department with code '${trimmedCode}' already exists`);
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('CREATED', requester);

  await pool.query(
    `INSERT INTO DEPARTMENT (deptCode, deptName, status, stamp)
     VALUES ($1, $2, 'Active', $3)`,
    [trimmedCode, trimmedName, stamp]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'CREATED', 'DEPARTMENT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({ deptCode: trimmedCode, deptName: trimmedName, status: 'Active' }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    deptCode: trimmedCode,
    deptName: trimmedName,
    status: 'Active',
    stamp,
  };
}

/**
 * PUT /api/hr/departments/:deptCode (Edit Department) (§2.3, §3.5, §3.8, S3-DEV-03).
 * - Guard: requireRight('dept.edit')
 * - Validates deptName (<= 100 chars)
 * - Updates stamp = 'EDITED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function updateDepartment({ deptCode, data = {}, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'dept.edit');

  const trimmedCode = typeof deptCode === 'string' ? deptCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Department code is required');
    err.status = 400;
    throw err;
  }

  const trimmedName = typeof data.deptName === 'string' ? data.deptName.trim() : '';
  if (!trimmedName) {
    const err = new Error('Department name is required');
    err.status = 400;
    throw err;
  }

  if (trimmedName.length > 100) {
    const err = new Error('Department name must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM DEPARTMENT WHERE deptCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Department not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE DEPARTMENT
     SET deptName = $1, stamp = $2
     WHERE deptCode = $3`,
    [trimmedName, stamp, trimmedCode]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'DEPARTMENT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: { deptName: existing.deptName ?? existing.deptname, status: existing.status },
          after: { deptName: trimmedName, status: existing.status },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    deptCode: trimmedCode,
    deptName: trimmedName,
    status: existing.status,
    stamp,
  };
}

/**
 * DELETE /api/hr/departments/:deptCode (Soft Delete Department) (§2.3, §3.5, §3.8, S3-DEV-03).
 * - Guard: requireRight('dept.delete')
 * - Prevents deletion if active JOBHISTORY records reference this department (409)
 * - Soft delete only: sets status = 'Inactive', stamp = 'DELETED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function softDeleteDepartment({ deptCode, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'dept.delete');

  const trimmedCode = typeof deptCode === 'string' ? deptCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Department code is required');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM DEPARTMENT WHERE deptCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Department not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  if (existing.status === 'Inactive') {
    const err = new Error('Department is already inactive');
    err.status = 400;
    throw err;
  }

  // Child-dependency verification: prevent deletion if active job history exists
  const childRes = await pool.query(
    "SELECT 1 FROM JOBHISTORY WHERE deptCode = $1 AND status = 'Active' LIMIT 1",
    [trimmedCode]
  );
  if (childRes.rows.length > 0) {
    const err = new Error('Cannot delete department: active job history records reference this department');
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('DELETED', requester);

  await pool.query(
    `UPDATE DEPARTMENT
     SET status = 'Inactive', stamp = $1
     WHERE deptCode = $2`,
    [stamp, trimmedCode]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'DELETED', 'DEPARTMENT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: { deptName: existing.deptName ?? existing.deptname, status: existing.status },
          after: { status: 'Inactive' },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    deptCode: trimmedCode,
    deptName: existing.deptName ?? existing.deptname,
    status: 'Inactive',
    stamp,
  };
}

/**
 * POST / PUT /api/hr/departments/:deptCode/restore (Restore Department) (§2.3, §3.5, S3-DEV-03).
 * - Strictly restricted to Admin and Superadmin
 * - Sets status = 'Active', stamp = 'EDITED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Logs to audit_log
 */
async function restoreDepartment({ deptCode, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role !== 'Admin' && requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: only Admin or Superadmin can restore departments');
    err.status = 403;
    throw err;
  }

  const trimmedCode = typeof deptCode === 'string' ? deptCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Department code is required');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM DEPARTMENT WHERE deptCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Department not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  if (existing.status === 'Active') {
    const err = new Error('Department is already active');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE DEPARTMENT
     SET status = 'Active', stamp = $1
     WHERE deptCode = $2`,
    [stamp, trimmedCode]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'RESTORED', 'DEPARTMENT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: { deptName: existing.deptName ?? existing.deptname, status: existing.status },
          after: { status: 'Active' },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    deptCode: trimmedCode,
    deptName: existing.deptName ?? existing.deptname,
    status: 'Active',
    stamp,
  };
}

/**
 * GET /api/hr/employees (§1.2, §3.5 Figures 15 & 20, S3-DEV-04).
 * - Superadmin/Admin: supports status filter ('Active', 'Inactive', 'All'), returns status, stamp, and counts.
 * - User: strictly forced to Active status, omits status and stamp fields.
 * - Live search against empNo, lastName, and firstName.
 */
async function listEmployees({ requester, search, status } = {}) {
  const pool = dbPool.getPool();

  await assertHrAccess(pool, requester);

  const isStandardUser = requester.role === 'User';

  let query =
    'SELECT empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, status, stamp FROM EMPLOYEE';
  const whereClauses = [];
  const params = [];

  if (isStandardUser) {
    whereClauses.push("status = 'Active'");
  } else {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'inactive') {
      whereClauses.push("status = 'Inactive'");
    } else if (normalizedStatus === 'all') {
      // No status filter
    } else {
      whereClauses.push("status = 'Active'");
    }
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    whereClauses.push(
      `(LOWER(empNo) LIKE $${pIdx} OR LOWER(lastName) LIKE $${pIdx} OR LOWER(firstName) LIKE $${pIdx})`
    );
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY empNo ASC';

  const { rows } = await pool.query(query, params);

  const employees = rows.map((r) => {
    const empNo = r.empNo ?? r.empno;
    const lastName = r.lastName ?? r.lastname ?? null;
    const firstName = r.firstName ?? r.firstname ?? null;
    const gender = r.gender ?? null;
    const birthDate = r.birthDate ?? r.birthdate ?? null;
    const hireDate = r.hireDate ?? r.hiredate ?? null;
    const sepDate = r.sepDate ?? r.sepdate ?? null;

    const base = {
      empNo,
      lastName,
      firstName,
      gender,
      birthDate,
      hireDate,
      sepDate: sepDate || null,
    };

    if (isStandardUser) {
      return base;
    }

    return {
      ...base,
      status: r.status,
      stamp: r.stamp,
    };
  });

  if (isStandardUser) {
    return {
      employees,
      total: employees.length,
    };
  }

  const countRes = await pool.query('SELECT status, COUNT(*) AS count FROM EMPLOYEE GROUP BY status');
  let activeCount = 0;
  let inactiveCount = 0;
  for (const row of countRes.rows || []) {
    const rowStatus = row.status;
    const cnt = Number(row.count ?? row.cnt ?? 0);
    if (rowStatus === 'Active') activeCount = cnt;
    else if (rowStatus === 'Inactive') inactiveCount = cnt;
  }

  return {
    employees,
    total: employees.length,
    counts: {
      active: activeCount,
      inactive: inactiveCount,
      all: activeCount + inactiveCount,
    },
  };
}

function isValidDateString(val) {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return false;
  }
  const d = new Date(`${val.trim()}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(val.trim());
}

function validateEmployeePayload(data = {}, { requireEmpNo = true } = {}) {
  const empNo = typeof data.empNo === 'string' ? data.empNo.trim() : '';
  const lastName = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  const firstName = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  const gender = typeof data.gender === 'string' ? data.gender.trim().toUpperCase() : '';
  const birthDate = typeof data.birthDate === 'string' ? data.birthDate.trim() : '';
  const hireDate = typeof data.hireDate === 'string' ? data.hireDate.trim() : '';
  const rawSepDate = data.sepDate;
  const sepDate =
    rawSepDate === null || rawSepDate === undefined || String(rawSepDate).trim() === ''
      ? null
      : String(rawSepDate).trim();

  if (requireEmpNo) {
    if (!empNo) {
      const err = new Error('Employee number (empNo) is required');
      err.status = 400;
      throw err;
    }
    if (empNo.length > 10) {
      const err = new Error('Employee number must not exceed 10 characters');
      err.status = 400;
      throw err;
    }
  }

  if (!lastName || !firstName) {
    const err = new Error('Last name and first name are required');
    err.status = 400;
    throw err;
  }

  if (lastName.length > 100 || firstName.length > 100) {
    const err = new Error('Last name and first name must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  if (gender !== 'M' && gender !== 'F') {
    const err = new Error("Gender must be 'M' or 'F'");
    err.status = 400;
    throw err;
  }

  if (!isValidDateString(birthDate) || !isValidDateString(hireDate)) {
    const err = new Error('Valid birthDate and hireDate (YYYY-MM-DD) are required');
    err.status = 400;
    throw err;
  }

  if (birthDate >= hireDate) {
    const err = new Error('birthDate must be strictly earlier than hireDate');
    err.status = 400;
    throw err;
  }

  if (sepDate !== null) {
    if (!isValidDateString(sepDate)) {
      const err = new Error('sepDate must be a valid date (YYYY-MM-DD)');
      err.status = 400;
      throw err;
    }
    if (sepDate < hireDate) {
      const err = new Error('sepDate must be greater than or equal to hireDate');
      err.status = 400;
      throw err;
    }
  }

  return { empNo, lastName, firstName, gender, birthDate, hireDate, sepDate };
}

/**
 * POST /api/hr/employees (Create Employee) (§2.3, §3.5, §3.8, §4.2, S3-DEV-05).
 */
async function createEmployee({ data = {}, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'emp.add');

  const validated = validateEmployeePayload(data, { requireEmpNo: true });

  const dupRes = await pool.query('SELECT 1 FROM EMPLOYEE WHERE empNo = $1', [validated.empNo]);
  if (dupRes.rows.length > 0) {
    const err = new Error(`Employee with number '${validated.empNo}' already exists`);
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('CREATED', requester);

  await pool.query(
    `INSERT INTO EMPLOYEE (empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, status, stamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8)`,
    [
      validated.empNo,
      validated.lastName,
      validated.firstName,
      validated.gender,
      validated.birthDate,
      validated.hireDate,
      validated.sepDate,
      stamp,
    ]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'CREATED', 'EMPLOYEE', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        validated.empNo,
        JSON.stringify({ ...validated, status: 'Active' }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    ...validated,
    status: 'Active',
    stamp,
  };
}

/**
 * PUT /api/hr/employees/:empNo (Edit Employee) (§2.3, §3.5, §3.8, §4.2, S3-DEV-05).
 */
async function updateEmployee({ empNo, data = {}, requester } = {}) {
  const pool = dbPool.getPool();

  await assertHrRight(pool, requester, 'emp.edit');

  const trimmedNo = typeof empNo === 'string' ? empNo.trim() : '';
  if (!trimmedNo) {
    const err = new Error('Employee number is required');
    err.status = 400;
    throw err;
  }

  const validated = validateEmployeePayload(data, { requireEmpNo: false });

  const existingRes = await pool.query('SELECT * FROM EMPLOYEE WHERE empNo = $1', [trimmedNo]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Employee not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE EMPLOYEE
     SET lastName = $1, firstName = $2, gender = $3, birthDate = $4, hireDate = $5, sepDate = $6, stamp = $7
     WHERE empNo = $8`,
    [
      validated.lastName,
      validated.firstName,
      validated.gender,
      validated.birthDate,
      validated.hireDate,
      validated.sepDate,
      stamp,
      trimmedNo,
    ]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'EMPLOYEE', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        trimmedNo,
        JSON.stringify({
          before: {
            lastName: existing.lastName ?? existing.lastname,
            firstName: existing.firstName ?? existing.firstname,
            status: existing.status,
          },
          after: {
            lastName: validated.lastName,
            firstName: validated.firstName,
            status: existing.status,
          },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    empNo: trimmedNo,
    lastName: validated.lastName,
    firstName: validated.firstName,
    gender: validated.gender,
    birthDate: validated.birthDate,
    hireDate: validated.hireDate,
    sepDate: validated.sepDate,
    status: existing.status,
    stamp,
  };
}

module.exports = {
  formatAuditStamp,
  assertHrAccess,
  assertHrRight,
  listJobs,
  createJob,
  updateJob,
  softDeleteJob,
  restoreJob,
  listDepartments,
  createDepartment,
  updateDepartment,
  softDeleteDepartment,
  restoreDepartment,
  listEmployees,
  createEmployee,
  updateEmployee,
};
