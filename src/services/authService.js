'use strict';

const { getPool } = require('../db/pool');
const bcrypt = require('bcryptjs');

/**
 * Login a user.
 * @param {Object} payload - { email, password, rememberMe }
 * @returns {{ token: string, user: Object }}
 */
async function loginUser({ email, password }) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM app_user WHERE email = $1', [email]);
  if (rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  const user = rows[0];
  const passwordMatches = await bcrypt.compare(password, user.passwordhash);
  if (!passwordMatches) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  if (user.isblocked === 1) {
    const err = new Error('Your account has been blocked. Please contact an administrator.');
    err.status = 403;
    throw err;
  }
  if (user.status !== 'Active') {
    const err = new Error('Account is not active');
    err.status = 403;
    throw err;
  }
  // Simple token generation (placeholder). In real app use JWT.
  const token = Buffer.from(String(user.userid)).toString('base64');
  return { token, user: { userId: user.userid, email: user.email, role: user.role } };
}

/**
 * Logout placeholder.
 */
async function logoutUser() {
  // In a stateless API, logout is handled client‑side by discarding the token.
  return;
}

module.exports = { loginUser, logoutUser };
