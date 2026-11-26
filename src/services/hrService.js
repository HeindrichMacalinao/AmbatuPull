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

module.exports = {
  formatAuditStamp,
  assertHrAccess,
  assertHrRight,
  listJobs,
  createJob,
  updateJob,
  softDeleteJob,
  restoreJob,
};
