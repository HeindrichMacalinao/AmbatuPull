'use strict';

const dbPool = require('../db/pool');

/**
 * Check if the requester is authorized to access the Customer module (§4.2 & S2-DEV-01).
 * Superadmin and Admin always have access.
 * Standard User must possess at least one active Customer right.
 */
async function assertCustomerAccess(pool, requester) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'Superadmin' || requester.role === 'Admin') {
    return;
  }

  if (requester.rights && Array.isArray(requester.rights)) {
    const hasCustRight = requester.rights.some(
      (r) => typeof r === 'string' && (r.startsWith('customer.') || r === 'customer')
    );
    if (hasCustRight) return;
  }

  const userId = requester.userId ?? requester.userid;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_permission
     WHERE userId = $1
       AND status = 'Active'
       AND (rightCode LIKE 'customer.%' OR rightCode = 'customer')
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('Forbidden: customer module access required');
    err.status = 403;
    throw err;
  }
}

/**
 * GET /api/customers (§1.2, §3.3 Figures 9-10, §4.2, S2-DEV-01).
 *
 * Query parameters:
 * - search: string matching custNo, custName, or address (case-insensitive)
 * - status: active | inactive | all (Admin/Superadmin only)
 *
 * Server-Side Role Visibility:
 * - User:
 *   - Enforce WHERE status = 'Active'
 *   - Completely omit status and stamp fields from JSON response
 *   - Ignore any status=all or status=inactive parameter
 * - Admin / Superadmin:
 *   - Support filtering by status: active, inactive, or all
 *   - Include status and stamp fields in JSON response
 */
async function listCustomers({ requester, search, status } = {}) {
  const pool = dbPool.getPool();

  await assertCustomerAccess(pool, requester);

  let query = 'SELECT custNo, custName, address, payTerms, status, stamp FROM CUSTOMER';
  const whereClauses = [];
  const params = [];

  // 1. Role-based status filtering (§1.2, §4.2)
  if (requester.role === 'User') {
    // User role is strictly forced to Active customers only in SQL
    whereClauses.push("status = 'Active'");
  } else {
    // Admin / Superadmin support status tab filtering
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'inactive') {
      whereClauses.push("status = 'Inactive'");
    } else if (normalizedStatus === 'all') {
      // No status filter
    } else {
      // Default to Active
      whereClauses.push("status = 'Active'");
    }
  }

  // 2. Live Search Filtering (case-insensitive on custNo, custName, address)
  if (search && typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    whereClauses.push(
      `(LOWER(custNo) LIKE $${pIdx} OR LOWER(custName) LIKE $${pIdx} OR LOWER(address) LIKE $${pIdx})`
    );
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY custNo ASC';

  const { rows } = await pool.query(query, params);

  // 3. Format response according to Server-Side Role Visibility Rules
  const isStandardUser = requester.role === 'User';

  return rows.map((r) => {
    const custNo = r.custNo ?? r.custno;
    const custName = r.custName ?? r.custname;
    const address = r.address ?? null;
    const payTerms = r.payTerms ?? r.payterms ?? null;

    if (isStandardUser) {
      // Completely omit status and stamp fields for standard User
      return {
        custNo,
        custName,
        address,
        payTerms,
      };
    }

    return {
      custNo,
      custName,
      address,
      payTerms,
      status: r.status,
      stamp: r.stamp,
    };
  });
}

/**
 * GET /api/customers/:custNo
 */
async function getCustomerByNo({ custNo, requester } = {}) {
  const pool = dbPool.getPool();

  await assertCustomerAccess(pool, requester);

  if (!custNo || typeof custNo !== 'string') {
    const err = new Error('Customer number is required');
    err.status = 400;
    throw err;
  }

  let query = 'SELECT custNo, custName, address, payTerms, status, stamp FROM CUSTOMER WHERE custNo = $1';
  const params = [custNo.trim()];

  if (requester.role === 'User') {
    query += " AND status = 'Active'";
  }

  const { rows } = await pool.query(query, params);
  if (rows.length === 0) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const r = rows[0];
  const no = r.custNo ?? r.custno;
  const name = r.custName ?? r.custname;
  const address = r.address ?? null;
  const payTerms = r.payTerms ?? r.payterms ?? null;

  if (requester.role === 'User') {
    return {
      custNo: no,
      custName: name,
      address,
      payTerms,
    };
  }

  return {
    custNo: no,
    custName: name,
    address,
    payTerms,
    status: r.status,
    stamp: r.stamp,
  };
}

module.exports = {
  assertCustomerAccess,
  listCustomers,
  getCustomerByNo,
};
