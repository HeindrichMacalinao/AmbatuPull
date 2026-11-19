'use strict';

const dbPool = require('../db/pool');

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
 * GET /api/products (§2.5, §3.4 Figures 11 & 14, §4.2, S2-DEV-04).
 *
 * Query parameters:
 * - search: string (filters prodCode or description, case-insensitive)
 * - status: 'active' | 'inactive' | 'all' (Admin/Superadmin only)
 *
 * Computes currentPrice from PRICEHIST:
 * - Latest effDate <= CURRENT_DATE where status = 'Active'
 * - If no active price exists on or before current date, currentPrice is null
 *
 * Role-based visibility:
 * - User role: Query strictly filters WHERE status = 'Active' (ignoring query status param);
 *   omits 'status' and 'stamp' columns.
 * - Admin/Superadmin role: Respects status filter (active, inactive, all);
 *   includes 'status' and 'stamp' columns.
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

module.exports = {
  assertProductAccess,
  listProducts,
  getProductByCode,
};
