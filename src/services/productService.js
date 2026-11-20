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

/**
 * DELETE /api/products/:prodCode (Soft Delete Product) (§2.3, §3.4, §3.8, S2-DEV-06).
 * - Requires right: 'product.delete' (or Superadmin/Admin)
 * - Prohibits hard delete; sets status = 'Inactive', stamp = 'DELETED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Rejects if product not found (404) or already Inactive (400)
 * - Preserves historical links in PRICEHIST and SALESDETAIL
 * - Records action to audit_log
 */
async function softDeleteProduct({ prodCode, requester } = {}) {
  const pool = dbPool.getPool();

  await assertProductRight(pool, requester, 'product.delete');

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Product code is required');
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
  if (existing.status === 'Inactive') {
    const err = new Error('Product is already inactive / deleted');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('DELETED', requester);

  await pool.query(
    `UPDATE PRODUCT
     SET status = 'Inactive', stamp = $1
     WHERE prodCode = $2`,
    [stamp, trimmedCode]
  );

  // Audit Logging (S2-DEV-06 Requirement 1)
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'DELETED', 'PRODUCT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: {
            status: existing.status,
            description: existing.description,
            unit: existing.unit,
          },
          after: {
            status: 'Inactive',
          },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    prodCode: trimmedCode,
    description: existing.description,
    unit: existing.unit,
    status: 'Inactive',
    stamp,
  };
}

/**
 * PUT /api/products/:prodCode/restore (Restore Product) (§2.3, §3.4, §3.8, S2-DEV-06).
 * - Strictly restricted to Admin and Superadmin
 * - Sets status = 'Active', stamp = 'RESTORED <currentUser> <YYYY-MM-DD HH:MM AM/PM>'
 * - Rejects if product not found (404) or already Active (400)
 * - Records action to audit_log
 */
async function restoreProduct({ prodCode, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role !== 'Admin' && requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: only Admin or Superadmin can restore products');
    err.status = 403;
    throw err;
  }

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Product code is required');
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
  if (existing.status === 'Active') {
    const err = new Error('Product is already active');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('RESTORED', requester);

  await pool.query(
    `UPDATE PRODUCT
     SET status = 'Active', stamp = $1
     WHERE prodCode = $2`,
    [stamp, trimmedCode]
  );

  // Audit Logging (S2-DEV-06 Requirement 2)
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'RESTORED', 'PRODUCT', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.role || 'system',
        trimmedCode,
        JSON.stringify({
          before: {
            status: existing.status,
            description: existing.description,
            unit: existing.unit,
          },
          after: {
            status: 'Active',
          },
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  return {
    prodCode: trimmedCode,
    description: existing.description,
    unit: existing.unit,
    status: 'Active',
    stamp,
  };
}


/**
 * GET /api/products/:prodCode/prices (§3.4 Figures 12 & 13, §4.2, S2-DEV-07).
 * Chronological price history ordered by effDate DESC.
 * Admin view includes status and stamp.
 * User view strictly returns active prices without status/stamp.
 */
async function listPrices({ prodCode, requester, status } = {}) {
  const pool = dbPool.getPool();

  await assertProductAccess(pool, requester);

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Product code is required');
    err.status = 400;
    throw err;
  }

  const prodRes = await pool.query('SELECT 1 FROM PRODUCT WHERE prodCode = $1', [trimmedCode]);
  if (prodRes.rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const isUser = requester.role !== 'Admin' && requester.role !== 'Superadmin';
  const normalizedStatus = String(status || '').trim().toLowerCase();

  let query = 'SELECT prodCode, effDate, unitPrice, status, stamp FROM PRICEHIST WHERE prodCode = $1';
  const queryParams = [trimmedCode];

  if (isUser) {
    query += " AND status = 'Active'";
  } else if (normalizedStatus === 'active') {
    query += " AND status = 'Active'";
  } else if (normalizedStatus === 'inactive') {
    query += " AND status = 'Inactive'";
  }

  query += ' ORDER BY effDate DESC';

  const { rows } = await pool.query(query, queryParams);

  if (isUser) {
    return rows.map((r) => ({
      prodCode: r.prodCode ?? r.prodcode,
      effDate: r.effDate ?? r.effdate,
      unitPrice: Number(r.unitPrice ?? r.unitprice),
    }));
  }

  return rows.map((r) => ({
    prodCode: r.prodCode ?? r.prodcode,
    effDate: r.effDate ?? r.effdate,
    unitPrice: Number(r.unitPrice ?? r.unitprice),
    status: r.status,
    stamp: r.stamp,
  }));
}

/**
 * POST /api/products/:prodCode/prices (Add Price) (§3.4, §3.8, S2-DEV-07).
 * - Guard: requireRight('price.add')
 * - Payload: { effDate, unitPrice }
 * - Validation: unitPrice > 0, valid date format, duplicate (prodCode, effDate) rejected with 400
 * - System Fields: status = 'Active', stamp = 'CREATED <currentUser> <timestamp>'
 * - Audit log entry recorded
 */
async function addPrice({ prodCode, effDate, unitPrice, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  await assertProductRight(pool, requester, 'price.add');

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  if (!trimmedCode) {
    const err = new Error('Product code is required');
    err.status = 400;
    throw err;
  }

  const prodRes = await pool.query('SELECT 1 FROM PRODUCT WHERE prodCode = $1', [trimmedCode]);
  if (prodRes.rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const trimmedDate = typeof effDate === 'string' ? effDate.trim() : '';
  if (!trimmedDate) {
    const err = new Error('Effective date is required');
    err.status = 400;
    throw err;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) || isNaN(Date.parse(trimmedDate))) {
    const err = new Error('Effective date must be a valid date in YYYY-MM-DD format');
    err.status = 400;
    throw err;
  }

  const priceNum = Number(unitPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    const err = new Error('Unit price must be a positive number greater than zero');
    err.status = 400;
    throw err;
  }

  const dupRes = await pool.query(
    'SELECT 1 FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2',
    [trimmedCode, trimmedDate]
  );
  if (dupRes.rows.length > 0) {
    const err = new Error('A price record already exists for this effective date');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('CREATED', requester);

  await pool.query(
    `INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp)
     VALUES ($1, $2, $3, 'Active', $4)`,
    [trimmedCode, trimmedDate, priceNum, stamp]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'CREATED', 'PRICEHIST', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        `${trimmedCode}:${trimmedDate}`,
        JSON.stringify({
          prodCode: trimmedCode,
          effDate: trimmedDate,
          unitPrice: priceNum,
          status: 'Active',
        }),
      ]
    );
  } catch {}

  return {
    prodCode: trimmedCode,
    effDate: trimmedDate,
    unitPrice: priceNum,
    status: 'Active',
    stamp,
  };
}

/**
 * PUT /api/products/:prodCode/prices/:effDate (Edit Price) (§3.4, §3.8, S2-DEV-07).
 * - Guard: requireRight('price.edit')
 * - Payload: { unitPrice }
 * - Validation: unitPrice > 0
 * - System Fields: stamp = 'EDITED <currentUser> <timestamp>'
 * - Audit log entry recorded
 */
async function updatePrice({ prodCode, effDate, unitPrice, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  await assertProductRight(pool, requester, 'price.edit');

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  const trimmedDate = typeof effDate === 'string' ? effDate.trim() : '';

  if (!trimmedCode || !trimmedDate) {
    const err = new Error('Product code and effective date are required');
    err.status = 400;
    throw err;
  }

  const priceNum = Number(unitPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    const err = new Error('Unit price must be a positive number greater than zero');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query(
    'SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2',
    [trimmedCode, trimmedDate]
  );
  if (existingRes.rows.length === 0) {
    const err = new Error('Price record not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  const stamp = formatAuditStamp('EDITED', requester);

  await pool.query(
    `UPDATE PRICEHIST
     SET unitPrice = $1, stamp = $2
     WHERE prodCode = $3 AND effDate = $4`,
    [priceNum, stamp, trimmedCode, trimmedDate]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'PRICEHIST', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        `${trimmedCode}:${trimmedDate}`,
        JSON.stringify({
          before: {
            unitPrice: Number(existing.unitPrice ?? existing.unitprice),
            status: existing.status,
          },
          after: {
            unitPrice: priceNum,
            status: existing.status,
          },
        }),
      ]
    );
  } catch {}

  return {
    prodCode: trimmedCode,
    effDate: trimmedDate,
    unitPrice: priceNum,
    status: existing.status,
    stamp,
  };
}

/**
 * DELETE /api/products/:prodCode/prices/:effDate (Delete Price) (§2.3, §3.4, §3.8, S2-DEV-07).
 * - Guard: requireRight('price.delete')
 * - Soft delete only: UPDATE status = 'Inactive', stamp = 'DELETED <currentUser> <timestamp>'
 * - Rejects 404 if not found, 400 if already Inactive
 * - Audit log entry recorded
 */
async function softDeletePrice({ prodCode, effDate, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  await assertProductRight(pool, requester, 'price.delete');

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  const trimmedDate = typeof effDate === 'string' ? effDate.trim() : '';

  if (!trimmedCode || !trimmedDate) {
    const err = new Error('Product code and effective date are required');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query(
    'SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2',
    [trimmedCode, trimmedDate]
  );
  if (existingRes.rows.length === 0) {
    const err = new Error('Price record not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  if (existing.status === 'Inactive') {
    const err = new Error('Price record is already inactive');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('DELETED', requester);

  await pool.query(
    `UPDATE PRICEHIST
     SET status = 'Inactive', stamp = $1
     WHERE prodCode = $2 AND effDate = $3`,
    [stamp, trimmedCode, trimmedDate]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'DELETED', 'PRICEHIST', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        `${trimmedCode}:${trimmedDate}`,
        JSON.stringify({
          before: {
            status: existing.status,
            unitPrice: Number(existing.unitPrice ?? existing.unitprice),
          },
          after: {
            status: 'Inactive',
          },
        }),
      ]
    );
  } catch {}

  return {
    prodCode: trimmedCode,
    effDate: trimmedDate,
    unitPrice: Number(existing.unitPrice ?? existing.unitprice),
    status: 'Inactive',
    stamp,
  };
}

/**
 * PUT /api/products/:prodCode/prices/:effDate/restore (Restore Price) (§2.3, §3.4, §3.8, S2-DEV-07).
 * - Guard: requireAdminOrSuperadmin (Admin or Superadmin only)
 * - Sets status = 'Active', stamp = 'RESTORED <currentUser> <timestamp>'
 * - Rejects 404 if not found, 400 if already Active
 * - Audit log entry recorded
 */
async function restorePrice({ prodCode, effDate, requester } = {}) {
  const pool = dbPool.getPool();

  if (!requester || !requester.role) {
    const err = new Error('Unauthorized: authentication required');
    err.status = 401;
    throw err;
  }

  if (requester.role !== 'Admin' && requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: only Admin or Superadmin can restore prices');
    err.status = 403;
    throw err;
  }

  const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
  const trimmedDate = typeof effDate === 'string' ? effDate.trim() : '';

  if (!trimmedCode || !trimmedDate) {
    const err = new Error('Product code and effective date are required');
    err.status = 400;
    throw err;
  }

  const existingRes = await pool.query(
    'SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2',
    [trimmedCode, trimmedDate]
  );
  if (existingRes.rows.length === 0) {
    const err = new Error('Price record not found');
    err.status = 404;
    throw err;
  }

  const existing = existingRes.rows[0];
  if (existing.status === 'Active') {
    const err = new Error('Price record is already active');
    err.status = 400;
    throw err;
  }

  const stamp = formatAuditStamp('RESTORED', requester);

  await pool.query(
    `UPDATE PRICEHIST
     SET status = 'Active', stamp = $1
     WHERE prodCode = $2 AND effDate = $3`,
    [stamp, trimmedCode, trimmedDate]
  );

  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'RESTORED', 'PRICEHIST', $2, $3, CURRENT_TIMESTAMP)`,
      [
        requester.email || requester.username || requester.role || 'system',
        `${trimmedCode}:${trimmedDate}`,
        JSON.stringify({
          before: {
            status: existing.status,
            unitPrice: Number(existing.unitPrice ?? existing.unitprice),
          },
          after: {
            status: 'Active',
          },
        }),
      ]
    );
  } catch {}

  return {
    prodCode: trimmedCode,
    effDate: trimmedDate,
    unitPrice: Number(existing.unitPrice ?? existing.unitprice),
    status: 'Active',
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
  softDeleteProduct,
  restoreProduct,
  listPrices,
  addPrice,
  updatePrice,
  softDeletePrice,
  restorePrice,
};
