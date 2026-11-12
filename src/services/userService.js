'use strict';

const dbPool = require('../db/pool');
const bcrypt = require('bcryptjs');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Last-Superadmin Guard Rule (§1.2 & S1-DEV-06).
 * Checks if target is an active, unblocked Superadmin.
 * If active unblocked Superadmins count <= 1, aborts with HTTP 403.
 */
async function assertNotLastActiveSuperadmin(pool, targetUser) {
  const isSuperadmin = targetUser.role === 'Superadmin';
  const isActive = targetUser.status === 'Active';
  const isUnblocked = !(targetUser.isBlocked === 1 || targetUser.isBlocked === true);

  if (isSuperadmin && isActive && isUnblocked) {
    const { rows } = await pool.query(
      "SELECT COUNT(*) AS count FROM app_user WHERE role = 'Superadmin' AND status = 'Active' AND isBlocked = FALSE"
    );
    const count = Number(rows[0]?.count ?? rows[0]?.COUNT ?? 0);
    if (count <= 1) {
      const err = new Error('Action blocked: Cannot remove, demote, or disable the last remaining Superadmin.');
      err.status = 403;
      throw err;
    }
  }
}

/**
 * List all users according to role visibility rules (§1.2, §3.8).
 * - Superadmin: see all accounts.
 * - Admin: Superadmin accounts are excluded. Admin peer accounts have canManage: false.
 * - User: 403 Forbidden.
 */
async function listUsers({ requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'User') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const pool = dbPool.getPool();
  let query = `
    SELECT userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp, createdAt
    FROM app_user
  `;
  const params = [];

  // Crucial Role Visibility Rule: Admin cannot see Superadmin accounts
  if (requester.role === 'Admin') {
    query += ` WHERE role != 'Superadmin'`;
  }

  query += ` ORDER BY userId ASC`;

  const { rows } = await pool.query(query, params);

  return rows.map((u) => {
    const userId = u.userId ?? u.userid;
    const role = u.role;
    const isBlocked = u.isBlocked === 1 || u.isBlocked === true;

    // Admin accounts displayed to Admin must have canManage: false so UI shows '—'
    const canManage = requester.role === 'Superadmin'
      ? true
      : (role !== 'Admin' && role !== 'Superadmin');

    return {
      userId,
      firstName: u.firstName ?? u.firstname,
      lastName: u.lastName ?? u.lastname,
      email: u.email,
      role: u.role,
      status: u.status,
      isBlocked,
      empNo: u.empNo ?? u.empno,
      stamp: u.stamp,
      createdAt: u.createdAt ?? u.createdat,
      canManage,
    };
  });
}

/**
 * Get a single user by ID with role visibility enforcement.
 */
async function getUserById({ id, requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'User') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const targetId = Number(id);
  if (!targetId || isNaN(targetId)) {
    const err = new Error('Invalid user ID');
    err.status = 400;
    throw err;
  }

  const pool = dbPool.getPool();
  const { rows } = await pool.query(
    'SELECT userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp FROM app_user WHERE userId = $1',
    [targetId]
  );

  if (rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const u = rows[0];

  // Admin cannot view Superadmin accounts
  if (requester.role === 'Admin' && u.role === 'Superadmin') {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const isBlocked = u.isBlocked === 1 || u.isBlocked === true;
  const canManage = requester.role === 'Superadmin'
    ? true
    : (u.role !== 'Admin' && u.role !== 'Superadmin');

  return {
    userId: u.userId ?? u.userid,
    firstName: u.firstName ?? u.firstname,
    lastName: u.lastName ?? u.lastname,
    email: u.email,
    role: u.role,
    status: u.status,
    isBlocked,
    empNo: u.empNo ?? u.empno,
    stamp: u.stamp,
    canManage,
  };
}

/**
 * Add a new user manually (S1-DEV-05).
 * - Admin can only create 'User' accounts.
 * - Superadmin can create 'Admin' or 'Superadmin'.
 */
async function createUser({ data, requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'User') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const { firstName, lastName, email, role = 'User', password, empNo } = data || {};

  if (!firstName || !lastName || !email) {
    const err = new Error('First name, last name, and email are required');
    err.status = 400;
    throw err;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    const err = new Error('Invalid email format');
    err.status = 400;
    throw err;
  }

  // Enforce role creation privileges
  if (requester.role === 'Admin' && role !== 'User') {
    const err = new Error('Admins can only create User accounts');
    err.status = 403;
    throw err;
  }

  if (!['User', 'Admin', 'Superadmin'].includes(role)) {
    const err = new Error('Invalid role specified');
    err.status = 400;
    throw err;
  }

  const pool = dbPool.getPool();

  // Check email uniqueness
  const existing = await pool.query('SELECT 1 FROM app_user WHERE email = $1', [cleanEmail]);
  if (existing.rowCount > 0) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const actorName = requester.email || requester.role || 'system';
  const initialPassword = password || 'TempPassword!123';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(initialPassword, saltRounds);
  const stamp = `CREATED ${actorName} ${new Date().toISOString()}`;

  const result = await pool.query(
    `INSERT INTO app_user (firstName, lastName, email, passwordHash, role, isBlocked, empNo, status, stamp)
     VALUES ($1, $2, $3, $4, $5, 0, $6, 'Active', $7)
     RETURNING userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp, createdAt`,
    [
      firstName.trim(),
      lastName.trim(),
      cleanEmail,
      passwordHash,
      role,
      empNo || null,
      stamp,
    ]
  );

  const newUser = result.rows && result.rows.length > 0 ? result.rows[0] : null;
  if (!newUser) {
    // Fallback lookup if RETURNING not returned
    const insertedRes = await pool.query('SELECT * FROM app_user WHERE email = $1', [cleanEmail]);
    const u = insertedRes.rows[0];
    return {
      userId: u.userId ?? u.userid,
      firstName: u.firstName ?? u.firstname,
      lastName: u.lastName ?? u.lastname,
      email: u.email,
      role: u.role,
      status: u.status,
      isBlocked: false,
      empNo: u.empNo ?? u.empno,
      stamp: u.stamp,
      createdAt: u.createdAt ?? u.createdat,
    };
  }

  return {
    userId: newUser.userId ?? newUser.userid,
    firstName: newUser.firstName ?? newUser.firstname,
    lastName: newUser.lastName ?? newUser.lastname,
    email: newUser.email,
    role: newUser.role,
    status: newUser.status,
    isBlocked: false,
    empNo: newUser.empNo ?? newUser.empno,
    stamp: newUser.stamp,
    createdAt: newUser.createdAt ?? newUser.createdat,
  };
}

/**
 * Edit an existing user (S1-DEV-05).
 * - Admin cannot edit Superadmin or other Admin accounts.
 * - Protects last active Superadmin against deactivation.
 */
async function updateUser({ id, data, requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'User') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const targetId = Number(id);
  if (!targetId || isNaN(targetId)) {
    const err = new Error('Invalid user ID');
    err.status = 400;
    throw err;
  }

  const pool = dbPool.getPool();
  const targetRes = await pool.query('SELECT * FROM app_user WHERE userId = $1', [targetId]);
  if (targetRes.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const targetUser = targetRes.rows[0];

  // Admin cannot edit Superadmin or other Admin accounts
  if (requester.role === 'Admin') {
    if (targetUser.role === 'Superadmin' || targetUser.role === 'Admin') {
      const err = new Error('Admins cannot edit Admin or Superadmin accounts');
      err.status = 403;
      throw err;
    }
  }

  const { firstName, lastName, email, empNo, status } = data || {};

  // Last-Superadmin Safeguard: Cannot deactivate last remaining active Superadmin
  if (status === 'Inactive' && targetUser.role === 'Superadmin') {
    await assertNotLastActiveSuperadmin(pool, targetUser);
  }

  let newEmail = targetUser.email;

  if (email && String(email).trim() !== '') {
    newEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(newEmail)) {
      const err = new Error('Invalid email format');
      err.status = 400;
      throw err;
    }
    if (newEmail !== targetUser.email.toLowerCase()) {
      const dup = await pool.query('SELECT 1 FROM app_user WHERE email = $1 AND userId != $2', [newEmail, targetId]);
      if (dup.rowCount > 0) {
        const err = new Error('Email already registered');
        err.status = 409;
        throw err;
      }
    }
  }

  const newFirstName = firstName !== undefined ? String(firstName).trim() : (targetUser.firstName ?? targetUser.firstname);
  const newLastName = lastName !== undefined ? String(lastName).trim() : (targetUser.lastName ?? targetUser.lastname);
  const newEmpNo = empNo !== undefined ? empNo : (targetUser.empNo ?? targetUser.empno);
  const newStatus = status !== undefined ? status : targetUser.status;

  const actorName = requester.email || requester.role || 'system';
  const stamp = `EDITED ${actorName} ${new Date().toISOString()}`;

  const updateRes = await pool.query(
    `UPDATE app_user
     SET firstName = $1, lastName = $2, email = $3, empNo = $4, stamp = $5
     WHERE userId = $6
     RETURNING userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp`,
    [newFirstName, newLastName, newEmail, newEmpNo, stamp, targetId]
  );

  const u = updateRes.rows && updateRes.rows.length > 0 ? updateRes.rows[0] : null;
  if (!u) {
    const fetched = await pool.query('SELECT * FROM app_user WHERE userId = $1', [targetId]);
    const row = fetched.rows[0];
    return {
      userId: row.userId ?? row.userid,
      firstName: row.firstName ?? row.firstname,
      lastName: row.lastName ?? row.lastname,
      email: row.email,
      role: row.role,
      status: row.status,
      isBlocked: row.isBlocked === 1 || row.isBlocked === true,
      empNo: row.empNo ?? row.empno,
      stamp: row.stamp,
    };
  }

  return {
    userId: u.userId ?? u.userid,
    firstName: u.firstName ?? u.firstname,
    lastName: u.lastName ?? u.lastname,
    email: u.email,
    role: u.role,
    status: u.status,
    isBlocked: u.isBlocked === 1 || u.isBlocked === true,
    empNo: u.empNo ?? u.empno,
    stamp: u.stamp,
  };
}

/**
 * Toggle or set account block state (S1-DEV-05, S1-DEV-06).
 * - Admin can only block/unblock standard 'User' accounts.
 * - Enforces Last-Superadmin Guard Rule: Cannot block last remaining active Superadmin.
 * - Updates user stamp and writes to audit_log if available.
 */
async function toggleUserBlock({ id, requester, isBlocked }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role === 'User') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const targetId = Number(id);
  if (!targetId || isNaN(targetId)) {
    const err = new Error('Invalid user ID');
    err.status = 400;
    throw err;
  }

  const pool = dbPool.getPool();
  const targetRes = await pool.query('SELECT * FROM app_user WHERE userId = $1', [targetId]);
  if (targetRes.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const targetUser = targetRes.rows[0];

  // Admin can only block/unblock standard User accounts (§1.2, §3.8)
  if (requester.role === 'Admin') {
    if (targetUser.role === 'Superadmin' || targetUser.role === 'Admin') {
      const err = new Error('Admins cannot block or unblock Admin or Superadmin accounts');
      err.status = 403;
      throw err;
    }
  }

  const currentBlocked = targetUser.isBlocked === 1 || targetUser.isBlocked === true;
  const newBlockedState = isBlocked !== undefined ? Boolean(isBlocked) : !currentBlocked;
  const newBlockedInt = newBlockedState ? 1 : 0;

  // Last-Superadmin Safeguard (S1-DEV-06): Cannot block the last active Superadmin
  if (newBlockedState && targetUser.role === 'Superadmin') {
    await assertNotLastActiveSuperadmin(pool, targetUser);
  }

  const actorName = requester.email || requester.role || 'system';
  const actionPrefix = newBlockedState ? 'BLOCKED' : 'UNBLOCKED';
  const stamp = `EDITED ${actorName} (${actionPrefix.toLowerCase()}) ${new Date().toISOString()}`;

  const updateRes = await pool.query(
    `UPDATE app_user
     SET isBlocked = $1, stamp = $2
     WHERE userId = $3
     RETURNING userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp`,
    [newBlockedInt, stamp, targetId]
  );

  // Attempt writing to audit_log if table exists
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, $2, 'app_user', $3, $4, CURRENT_TIMESTAMP)`,
      [
        actorName,
        actionPrefix,
        String(targetId),
        JSON.stringify({ isBlocked: newBlockedState }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  const u = updateRes.rows && updateRes.rows.length > 0 ? updateRes.rows[0] : null;
  const userObj = u
    ? {
        userId: u.userId ?? u.userid,
        firstName: u.firstName ?? u.firstname,
        lastName: u.lastName ?? u.lastname,
        email: u.email,
        role: u.role,
        status: u.status,
        isBlocked: newBlockedState,
        empNo: u.empNo ?? u.empno,
        stamp: u.stamp,
      }
    : {
        userId: targetUser.userId ?? targetUser.userid,
        firstName: targetUser.firstName ?? targetUser.firstname,
        lastName: targetUser.lastName ?? targetUser.lastname,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
        isBlocked: newBlockedState,
        empNo: targetUser.empNo ?? targetUser.empno,
        stamp,
      };

  return {
    user: userObj,
    message: newBlockedState ? 'User has been blocked' : 'User has been unblocked',
  };
}

/**
 * Superadmin Governance: Update user role (S1-DEV-06).
 * - Restricted strictly to Superadmin role.
 * - Allows designating a user as 'Admin', 'User', or 'Superadmin'.
 * - Enforces Last-Superadmin Guard Rule: Cannot demote the last remaining Superadmin.
 * - Records role modifications in audit_log.
 */
async function updateUserRole({ id, role, requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  // Restricted strictly to Superadmin
  if (requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: only Superadmin can modify user roles');
    err.status = 403;
    throw err;
  }

  const targetId = Number(id);
  if (!targetId || isNaN(targetId)) {
    const err = new Error('Invalid user ID');
    err.status = 400;
    throw err;
  }

  if (!role || typeof role !== 'string' || !role.trim()) {
    const err = new Error('Role is required');
    err.status = 400;
    throw err;
  }

  const newRole = role.trim();
  if (!['User', 'Admin', 'Superadmin'].includes(newRole)) {
    const err = new Error('Invalid role specified');
    err.status = 400;
    throw err;
  }

  const pool = dbPool.getPool();
  const targetRes = await pool.query('SELECT * FROM app_user WHERE userId = $1', [targetId]);
  if (targetRes.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const targetUser = targetRes.rows[0];

  // Last-Superadmin Guard Rule: Cannot demote the last active Superadmin
  if (targetUser.role === 'Superadmin' && newRole !== 'Superadmin') {
    await assertNotLastActiveSuperadmin(pool, targetUser);
  }

  const actorName = requester.email || requester.role || 'system';
  const stamp = `EDITED ${actorName} (role: ${newRole}) ${new Date().toISOString()}`;

  const updateRes = await pool.query(
    `UPDATE app_user
     SET role = $1, stamp = $2
     WHERE userId = $3
     RETURNING userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp`,
    [newRole, stamp, targetId]
  );

  // Audit Logging (S1-DEV-06): Log role modifications into audit_log
  try {
    await pool.query(
      `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
       VALUES ($1, 'EDITED', 'app_user', $2, $3, CURRENT_TIMESTAMP)`,
      [
        actorName,
        String(targetId),
        JSON.stringify({
          field: 'role',
          oldRole: targetUser.role,
          newRole,
        }),
      ]
    );
  } catch {
    // Non-fatal if audit_log table is absent or handled by trigger
  }

  const u = updateRes.rows && updateRes.rows.length > 0 ? updateRes.rows[0] : null;
  const userObj = u
    ? {
        userId: u.userId ?? u.userid,
        firstName: u.firstName ?? u.firstname,
        lastName: u.lastName ?? u.lastname,
        email: u.email,
        role: u.role,
        status: u.status,
        isBlocked: u.isBlocked === 1 || u.isBlocked === true,
        empNo: u.empNo ?? u.empno,
        stamp: u.stamp,
      }
    : {
        userId: targetUser.userId ?? targetUser.userid,
        firstName: targetUser.firstName ?? targetUser.firstname,
        lastName: targetUser.lastName ?? targetUser.lastname,
        email: targetUser.email,
        role: newRole,
        status: targetUser.status,
        isBlocked: targetUser.isBlocked === 1 || targetUser.isBlocked === true,
        empNo: targetUser.empNo ?? targetUser.empno,
        stamp,
      };

  return {
    user: userObj,
    message: `User role updated to ${newRole}`,
  };
}

/**
 * GET /api/users/:id/rights (S1-DEV-07).
 * - Admin can only inspect rights of User accounts.
 * - Superadmin can inspect rights of any account.
 * - User role cannot inspect rights (403).
 */
async function getUserRights({ id, requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role !== 'Admin' && requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const targetId = Number(id);
  if (!targetId || isNaN(targetId) || targetId <= 0) {
    const err = new Error('Invalid user ID');
    err.status = 400;
    throw err;
  }

  const pool = dbPool.getPool();
  const targetRes = await pool.query('SELECT * FROM app_user WHERE userId = $1', [targetId]);
  if (targetRes.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const targetUser = targetRes.rows[0];

  // Crucial rule (§3.8 & S1-DEV-07): Admin can only inspect rights of User accounts
  if (requester.role === 'Admin' && (targetUser.role === 'Admin' || targetUser.role === 'Superadmin')) {
    const err = new Error('Forbidden: Admins can only view rights of standard User accounts');
    err.status = 403;
    throw err;
  }

  const rightsRes = await pool.query(
    "SELECT rightCode FROM user_permission WHERE userId = $1 AND status = 'Active' ORDER BY rightCode ASC",
    [targetId]
  );

  const rightCodes = rightsRes.rows.map((r) => r.rightCode ?? r.rightcode);

  return {
    userId: targetId,
    rightCodes,
    rights: rightCodes,
  };
}

/**
 * PUT /api/users/:id/rights (S1-DEV-07).
 * - Request payload: { rightCodes: ['customer.add', ...] }
 * - Validate that all submitted codes exist in the rights table.
 * - Synchronize with user_permission junction table (insert missing, remove/deactivate unchecked).
 * - Only Admin or Superadmin can modify rights; Admins restricted to User accounts.
 * - Update user stamp and record entry in audit_log.
 */
async function updateUserRights({ id, rightCodes, requester }) {
  if (!requester || !requester.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (requester.role !== 'Admin' && requester.role !== 'Superadmin') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  const targetId = Number(id);
  if (!targetId || isNaN(targetId) || targetId <= 0) {
    const err = new Error('Invalid user ID');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(rightCodes)) {
    const err = new Error('rightCodes must be an array of right codes');
    err.status = 400;
    throw err;
  }

  for (const code of rightCodes) {
    if (typeof code !== 'string' || !code.trim()) {
      const err = new Error('Each rightCode must be a non-empty string');
      err.status = 400;
      throw err;
    }
  }

  const requestedCodes = [...new Set(rightCodes.map((c) => c.trim()))];

  const pool = dbPool.getPool();
  const targetRes = await pool.query('SELECT * FROM app_user WHERE userId = $1', [targetId]);
  if (targetRes.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const targetUser = targetRes.rows[0];

  // Crucial rule: Admins can only modify rights of standard User accounts
  if (requester.role === 'Admin' && (targetUser.role === 'Admin' || targetUser.role === 'Superadmin')) {
    const err = new Error('Forbidden: Admins can only modify rights of standard User accounts');
    err.status = 403;
    throw err;
  }

  // Validate that all submitted codes exist in the rights table
  const allRightsRes = await pool.query('SELECT rightCode FROM rights');
  const validCodes = new Set(allRightsRes.rows.map((r) => r.rightCode ?? r.rightcode));

  if (validCodes.size > 0) {
    const invalidCodes = requestedCodes.filter((c) => !validCodes.has(c));
    if (invalidCodes.length > 0) {
      const err = new Error(`Invalid right code(s): ${invalidCodes.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  // Synchronize with user_permission junction table
  const existingRes = await pool.query(
    'SELECT rightCode, status FROM user_permission WHERE userId = $1',
    [targetId]
  );
  const existingMap = new Map();
  for (const row of existingRes.rows) {
    existingMap.set(row.rightCode ?? row.rightcode, row.status);
  }

  const requestedSet = new Set(requestedCodes);
  const grantedRights = [];
  const revokedRights = [];

  const actorName = requester.email || requester.role || 'system';
  const stamp = `RIGHTS_UPDATED ${actorName} ${new Date().toISOString()}`;

  // 1. Insert missing or reactivate inactive rights
  for (const code of requestedCodes) {
    if (!existingMap.has(code)) {
      await pool.query(
        'INSERT INTO user_permission (userId, rightCode, status, stamp) VALUES ($1, $2, $3, $4)',
        [targetId, code, 'Active', stamp]
      );
      grantedRights.push(code);
    } else if (existingMap.get(code) !== 'Active') {
      await pool.query(
        'UPDATE user_permission SET status = $1, stamp = $2 WHERE userId = $3 AND rightCode = $4',
        ['Active', stamp, targetId, code]
      );
      grantedRights.push(code);
    }
  }

  // 2. Deactivate unchecked active rights (soft revocation per §2.4, §3.8)
  for (const [code, status] of existingMap.entries()) {
    if (!requestedSet.has(code) && status === 'Active') {
      await pool.query(
        'UPDATE user_permission SET status = $1, stamp = $2 WHERE userId = $3 AND rightCode = $4',
        ['Inactive', stamp, targetId, code]
      );
      revokedRights.push(code);
    }
  }

  // 3. Update user's stamp and audit log if rights were modified
  if (grantedRights.length > 0 || revokedRights.length > 0) {
    await pool.query(
      'UPDATE app_user SET stamp = $1 WHERE userId = $2',
      [stamp, targetId]
    );

    try {
      await pool.query(
        `INSERT INTO audit_log (performedBy, action, tableName, recordId, details, timestamp)
         VALUES ($1, 'RIGHTS_UPDATED', 'user_permission', $2, $3, CURRENT_TIMESTAMP)`,
        [
          actorName,
          String(targetId),
          JSON.stringify({
            granted: grantedRights,
            revoked: revokedRights,
          }),
        ]
      );
    } catch {
      // Non-fatal if audit_log table is absent or handled by trigger
    }
  }

  return {
    message: 'User rights updated successfully',
    userId: targetId,
    rightCodes: requestedCodes,
    rights: requestedCodes,
    granted: grantedRights,
    revoked: revokedRights,
  };
}

module.exports = {
  assertNotLastActiveSuperadmin,
  listUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserBlock,
  updateUserRole,
  getUserRights,
  updateUserRights,
};
