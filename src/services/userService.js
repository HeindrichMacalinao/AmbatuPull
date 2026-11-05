'use strict';

const dbPool = require('../db/pool');
const bcrypt = require('bcryptjs');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
    SELECT userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp
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
     RETURNING userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp`,
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
  };
}

/**
 * Edit an existing user (S1-DEV-05).
 * - Admin cannot edit Superadmin or other Admin accounts.
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

  const { firstName, lastName, email, empNo } = data || {};
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
 * Toggle or set account block state (S1-DEV-05).
 * - Admin can only block/unblock standard 'User' accounts.
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

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserBlock,
};
