'use strict';

const dbPool = require('../db/pool');

const ALLOWED_UNITS = [
  'pcs',
  'can',
  'pair',
  'meter',
  'box',
  'kg',
  'set',
  'License',
  'Service',
  'User/Mo',
];

/**
 * Validate packaging unit against allowed values (§2.2 & S2-DEV-05).
 * Returns the canonical casing string.
 */
function validatePackagingUnit(unit) {
  if (!unit || typeof unit !== 'string' || !unit.trim()) {
    const err = new Error(`Packaging unit is required. Allowed values: ${ALLOWED_UNITS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const trimmed = unit.trim();
  const matched = ALLOWED_UNITS.find((u) => u.toLowerCase() === trimmed.toLowerCase());
  if (!matched) {
    const err = new Error(`Invalid packaging unit. Allowed values: ${ALLOWED_UNITS.join(', ')}`);
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
 * Check if the requester is authorized to access the Product module (§4.2 & S2-DEV-04).
 * Superadmin and Admin always have access.
 * Standard User must possess at least one active Product or Price right.
 */
async function assertProductAccess(pool, requester) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'Superadmin' || requester.role === 'Admin') {
    return;
  }

  if (requester.rights && Array.isArray(requester.rights)) {
    const hasProdRight = requester.rights.some(
      (r) =>
        typeof r === 'string' &&
        (r.startsWith('product.') || r === 'product' || r.startsWith('price.') || r === 'price' || r === '*')
    );
    if (hasProdRight) return;
  }

  const userId = requester.userId ?? requester.userid;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_permission
     WHERE userId = $1
       AND status = 'Active'
       AND (rightCode LIKE 'product.%' OR rightCode = 'product' OR rightCode LIKE 'price.%' OR rightCode = 'price')
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('Forbidden: product module access required');
    err.status = 403;
    throw err;
  }
}

/**
 * Check if requester has a specific product right (§4.2, §3.8, S2-DEV-05).
 */
async function assertProductRight(pool, requester, rightCode) {
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
 * GET /api/products (§2.5, §3.4 Figures 11 & 14, §4.2, S2-DEV-04).
 */
async function listProducts({ requester, search, status } = {}) {
  const pool = dbPool.getPool();

  await assertProductAccess(pool, requester);

  const isStandardUser = requester.role === 'User';

  const whereClauses = [];
  const params = [];

  // 1. Role-based status filtering (§3.4, §4.2, S2-DEV-04)
  if (isStandardUser) {
    whereClauses.push("p.status = 'Active'");
  } else {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'inactive') {
      whereClauses.push("p.status = 'Inactive'");
    } else if (normalizedStatus === 'all') {
      // No status filter
    } else {
      // Default to active
      whereClauses.push("p.status = 'Active'");
    }
  }

  // 2. Live Search Filtering (case-insensitive on prodCode, description)
  if (search && typeof search === 'string' && search.trim().length > 0) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    whereClauses.push(
      `(LOWER(p.prodCode) LIKE $${pIdx} OR LOWER(p.description) LIKE $${pIdx})`
    );
  }

  let query = `
    SELECT p.prodCode, p.description, p.unit, p.status, p.stamp,
           (SELECT ph.unitPrice
            FROM PRICEHIST ph
            WHERE ph.prodCode = p.prodCode
              AND ph.effDate <= CURRENT_DATE
              AND ph.status = 'Active'
            ORDER BY ph.effDate DESC
            LIMIT 1) AS currentPrice
    FROM PRODUCT p
  `;

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY p.prodCode ASC';

  const { rows } = await pool.query(query, params);

  return rows.map((r) => {
    const prodCode = r.prodCode ?? r.prodcode;
    const description = r.description;
    const unit = r.unit ?? null;
    const currentPrice = r.currentPrice != null
      ? Number(r.currentPrice)
      : (r.currentprice != null ? Number(r.currentprice) : null);

    if (isStandardUser) {
      return {
        prodCode,
        description,
        unit,
        currentPrice,
      };
    }

    return {
      prodCode,
      description,
      unit,
      currentPrice,
      status: r.status,
      stamp: r.stamp,
    };
  });
}

/**
 * GET /api/products/:prodCode
 * Returns a single product with currentPrice respecting role-based visibility.
 */
async function getProductByCode({ prodCode, requester } = {}) {
  const pool = dbPool.getPool();

  await assertProductAccess(pool, requester);

  if (!prodCode || typeof prodCode !== 'string' || !prodCode.trim()) {
    const err = new Error('Product code is required');
    err.status = 400;
    throw err;
  }

  const trimmedCode = prodCode.trim();
  const isStandardUser = requester.role === 'User';

  const query = `
    SELECT p.prodCode, p.description, p.unit, p.status, p.stamp,
           (SELECT ph.unitPrice
            FROM PRICEHIST ph
            WHERE ph.prodCode = p.prodCode
              AND ph.effDate <= CURRENT_DATE
              AND ph.status = 'Active'
            ORDER BY ph.effDate DESC
            LIMIT 1) AS currentPrice
    FROM PRODUCT p
    WHERE p.prodCode = $1
  `;

  const { rows } = await pool.query(query, [trimmedCode]);

  if (rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const r = rows[0];

  // Standard users cannot view Inactive products
  if (isStandardUser && r.status === 'Inactive') {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const currentPrice = r.currentPrice != null
    ? Number(r.currentPrice)
    : (r.currentprice != null ? Number(r.currentprice) : null);

  if (isStandardUser) {
    return {
      prodCode: r.prodCode ?? r.prodcode,
      description: r.description,
      unit: r.unit ?? null,
      currentPrice,
    };
  }

  return {
    prodCode: r.prodCode ?? r.prodcode,
    description: r.description,
    unit: r.unit ?? null,
    currentPrice,
    status: r.status,
    stamp: r.stamp,
  };
}

/**
 * POST /api/products (Create Product) (§2.2, §3.4, §3.8, S2-DEV-05).
 * - Requires right: 'product.add'
 * - Validates: prodCode, description, unit
 * - Sets: status = 'Active', stamp = 'CREATED <currentUser> <timestamp>'
 * - Records audit log entry
 */
async function createProduct({ data, requester } = {}) {
  const pool = dbPool.getPool();

  await assertProductRight(pool, requester, 'product.add');

  if (!data || typeof data !== 'object') {
    const err = new Error('Request body must be a valid JSON object');
    err.status = 400;
    throw err;
  }

  const prodCode = typeof data.prodCode === 'string' ? data.prodCode.trim() : '';
  if (!prodCode || prodCode.length > 10) {
    const err = new Error('Product code is required and must not exceed 10 characters');
    err.status = 400;
    throw err;
  }

  // Format check: alphanumeric, hyphens, underscores (e.g. 'P-001')
  if (!/^[A-Za-z0-9_-]+$/.test(prodCode)) {
    const err = new Error('Product code must contain only alphanumeric characters, dashes, or underscores');
    err.status = 400;
    throw err;
  }

  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (!description || description.length > 100) {
    const err = new Error('Description is required and must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const unit = validatePackagingUnit(data.unit);

  // Check unique prodCode against existing products
  const existingRes = await pool.query('SELECT 1 FROM PRODUCT WHERE prodCode = $1', [prodCode]);
  if (existingRes.rows.length > 0) {
    const err = new Error(`Product with code '${prodCode}' already exists`);
    err.status = 409;
    throw err;
  }

  const stamp = formatAuditStamp('CREATED', requester);
  const status = 'Active';

  await pool.query(
    `INSERT INTO PRODUCT (prodCode, description, unit, status, stamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [prodCode, description, unit, status, stamp]
  );

  // Audit Logging (S2-DEV-05 Requirement 3)
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'CREATED', 'PRODUCT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.role || 'system',
        prodCode,
        JSON.stringify({
          prodCode,
          description,
          unit,
          status,
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    prodCode,
    description,
    unit,
    status,
    stamp,
  };
}

/**
 * PUT /api/products/:prodCode (Edit Product) (§2.2, §3.4, §3.8, S2-DEV-05).
 * - Requires right: 'product.edit'
 * - Validates: description, unit
 * - Updates: stamp = 'EDITED <currentUser> <timestamp>'
 * - Records audit log entry
 */
async function updateProduct({ prodCode, data, requester } = {}) {
  const pool = dbPool.getPool();

  await assertProductRight(pool, requester, 'product.edit');

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Product code is required');
    err.status = 400;
    throw err;
  }

  if (!data || typeof data !== 'object') {
    const err = new Error('Request body must be a valid JSON object');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query('SELECT * FROM PRODUCT WHERE prodCode = $1', [trimmedCode]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];

  const description = data.description !== undefined
    ? String(data.description).trim()
    : existing.description;

  if (!description || description.length > 100) {
    const err = new Error('Description is required and must not exceed 100 characters');
    err.status = 400;
    throw err;
  }

  const unit = data.unit !== undefined
    ? validatePackagingUnit(data.unit)
    : existing.unit;

  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE PRODUCT
     SET description = $1, unit = $2, stamp = $3
     WHERE prodCode = $4`,
    [description, unit, stamp, trimmedCode]
  );

  // Audit Logging (S2-DEV-05 Requirement 3)
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'PRODUCT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: {
            description: existing.description,
            unit: existing.unit,
            status: existing.status,
          },
          after: {
            description,
            unit,
            status: existing.status,
          },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    prodCode: trimmedCode,
    description,
    unit,
    status: existing.status,
    stamp,
  };
}

module.exports = {
  ALLOWED_UNITS,
  validatePackagingUnit,
  formatAuditStamp,
  assertProductAccess,
  assertProductRight,
  listProducts,
  getProductByCode,
  createProduct,
  updateProduct,
};
