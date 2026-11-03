'use strict';

const { getPool } = require('../db/pool');
const bcrypt = require('bcryptjs');

/**
 * Login a user.
 * @param {Object} payload - { email, password, rememberMe }
 * @returns {{ token: string, user: Object }}
 */
async function loginUser({ email, password } = {}) {
  // 1. Guard against missing fields
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.status = 400;
    throw err;
  }

  // 2. Normalize email
  const cleanEmail = String(email).trim().toLowerCase();

  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM app_user WHERE email = $1', [cleanEmail]);
  if (rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const user = rows[0];

  // 3. Fallback for column casing across DB drivers (Postgres vs SQLite)
  const passwordHash = user.passwordHash || user.passwordhash;
  const isBlocked = user.isBlocked ?? user.isblocked;
  const userId = user.userId ?? user.userid;

  const passwordMatches = await bcrypt.compare(password, passwordHash);
  if (!passwordMatches) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  if (isBlocked === 1 || isBlocked === true) {
    const err = new Error('Your account has been blocked. Please contact an administrator.');
    err.status = 403;
    throw err;
  }

  if (user.status !== 'Active') {
    const err = new Error('Account is not active');
    err.status = 403;
    throw err;
  }

  // Placeholder token
  const token = Buffer.from(String(userId)).toString('base64');
  return { token, user: { userId, email: user.email, role: user.role } };
}

/**
 * Logout placeholder.
 */
async function logoutUser() {
  // In a stateless API, logout is handled client‑side by discarding the token.
  return;
}

module.exports = { loginUser, logoutUser };
