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

module.exports = {
  formatAuditStamp,
  assertHrAccess,
  assertHrRight,
  listJobs,
};
