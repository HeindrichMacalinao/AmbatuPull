'use strict';

const dbPool = require('../db/pool');

const ALLOWED_PAY_TERMS = ['Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid'];

/**
 * Validate payment terms against the allowed list: 'Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid'.
 * Returns the canonical casing string.
 */
function validatePayTerms(payTerms) {
  if (!payTerms || typeof payTerms !== 'string' || !payTerms.trim()) {
    const err = new Error(`Payment terms are required. Allowed values: ${ALLOWED_PAY_TERMS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const trimmed = payTerms.trim();
  const matched = ALLOWED_PAY_TERMS.find((t) => t.toLowerCase() === trimmed.toLowerCase());
  if (!matched) {
    const err = new Error(`Invalid payment terms. Allowed values: ${ALLOWED_PAY_TERMS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  return matched;
}

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
      (r) => typeof r === 'string' && (r.startsWith('customer.') || r === 'customer' || r === '*')
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
 * Check if requester has a specific customer right (§4.2, §3.8, S2-DEV-02).
 */
async function assertCustomerRight(pool, requester, rightCode) {
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
 * GET /api/customers (§1.2, §3.3 Figures 9-10, §4.2, S2-DEV-01).
 */
async function listCustomers({ requester, search, status } = {}) {
  const pool = dbPool.getPool();

  await assertCustomerAccess(pool, requester);

  let query = 'SELECT custNo, custName, address, payTerms, status, stamp FROM CUSTOMER';
  const whereClauses = [];
  const params = [];

  // 1. Role-based status filtering (§1.2, §4.2)
  if (requester.role === 'User') {
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

  const isStandardUser = requester.role === 'User';

  return rows.map((r) => {
    const custNo = r.custNo ?? r.custno;
    const custName = r.custName ?? r.custname;
    const address = r.address ?? null;
    const payTerms = r.payTerms ?? r.payterms ?? null;

    if (isStandardUser) {
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

/**
 * POST /api/customers (Create Customer) (§2.3, §3.3, §3.8, S2-DEV-02).
 * - Requires right: 'customer.add'
 * - Validates: custNo, custName, payTerms
 * - Sets: status = 'Active', stamp = 'CREATED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Records audit log entry
 */
async function createCustomer({ data, requester } = {}) {
  const pool = dbPool.getPool();

  await assertCustomerRight(pool, requester, 'customer.add');

  if (!data || typeof data !== 'object') {
    const err = new Error('Request body must be a valid JSON object');
    err.status = 400;
    throw err;
  }

  const custNo = typeof data.custNo === 'string' ? data.custNo.trim() : '';
  if (!custNo || custNo.length > 10) {
    const err = new Error('Customer number is required and must not exceed 10 characters');
    err.status = 400;
    throw err;
  }

  const custName = typeof data.custName === 'string' ? data.custName.trim() : '';
  if (!custName || custName.length > 100) {
    const err = new Error('Customer name is required and must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const address = typeof data.address === 'string' ? data.address.trim() : null;
  if (address && address.length > 200) {
    const err = new Error('Address must not exceed 200 characters');
    err.status = 400;
    throw err;
  }

  const payTerms = validatePayTerms(data.payTerms);

  // Check unique custNo against existing customers
  const existingRes = await pool.query('SELECT 1 FROM CUSTOMER WHERE custNo = $1', [custNo]);
  if (existingRes.rows.length > 0) {
    const err = new Error(`Customer with number '${custNo}' already exists`);
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('CREATED', requester);
  const status = 'Active';

  await pool.query(
    `INSERT INTO CUSTOMER (custNo, custName, address, payTerms, status, stamp)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [custNo, custName, address, payTerms, status, stamp]
  );

  // Audit Logging (S2-DEV-02 Requirement 3)
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'CREATED', 'CUSTOMER', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.role || 'system',
        custNo,
        JSON.stringify({
          custNo,
          custName,
          address,
          payTerms,
          status,
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    custNo,
    custName,
    address,
    payTerms,
    status,
    stamp,
  };
}

/**
 * PUT /api/customers/:custNo (Edit Customer) (§2.3, §3.3, §3.8, S2-DEV-02).
 * - Requires right: 'customer.edit'
 * - Validates: required fields, payment terms
 * - Updates: stamp = 'EDITED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Records audit log entry
 */
async function updateCustomer({ custNo, data, requester } = {}) {
  const pool = dbPool.getPool();

  await assertCustomerRight(pool, requester, 'customer.edit');

  const trimmedCustNo = typeof custNo === 'string' ? custNo.trim() : '';
  if (!trimmedCustNo) {
    const err = new Error('Customer number is required');
    err.status = 400;
    throw err;
  }

  if (!data || typeof data !== 'object') {
    const err = new Error('Request body must be a valid JSON object');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM CUSTOMER WHERE custNo = $1', [trimmedCustNo]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];

  const custName = data.custName !== undefined
    ? String(data.custName).trim()
    : (existing.custName ?? existing.custname);

  if (!custName || custName.length > 100) {
    const err = new Error('Customer name is required and must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const address = data.address !== undefined
    ? (data.address ? String(data.address).trim() : null)
    : existing.address;

  if (address && address.length > 200) {
    const err = new Error('Address must not exceed 200 characters');
    err.status = 400;
    throw err;
  }

  const payTerms = data.payTerms !== undefined
    ? validatePayTerms(data.payTerms)
    : (existing.payTerms ?? existing.payterms);

  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE CUSTOMER
     SET custName = $1, address = $2, payTerms = $3, stamp = $4
     WHERE custNo = $5`,
    [custName, address, payTerms, stamp, trimmedCustNo]
  );

  // Audit Logging (S2-DEV-02 Requirement 3)
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'CUSTOMER', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.role || 'system',
        trimmedCustNo,
        JSON.stringify({
          before: {
            custName: existing.custName ?? existing.custname,
            address: existing.address,
            payTerms: existing.payTerms ?? existing.payterms,
            status: existing.status,
          },
          after: {
            custName,
            address,
            payTerms,
            status: existing.status,
          },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    custNo: trimmedCustNo,
    custName,
    address,
    payTerms,
    status: existing.status,
    stamp,
  };
}

module.exports = {
  ALLOWED_PAY_TERMS,
  validatePayTerms,
  formatAuditStamp,
  assertCustomerAccess,
  assertCustomerRight,
  listCustomers,
  getCustomerByNo,
  createCustomer,
  updateCustomer,
};
