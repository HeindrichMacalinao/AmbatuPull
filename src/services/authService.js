'use strict';

const crypto = require('crypto');
const dbPool = require('../db/pool');
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

  const pool = dbPool.getPool();
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

/**
 * Request password reset (S1-DEV-04).
 * Generates cryptographically secure random token, calculates SHA-256 hash,
 * stores hashed token with 1-hour expiration, invalidates previous unexpired tokens,
 * and logs reset link in development.
 * Always returns HTTP 200 with generic success message to prevent account enumeration.
 * @param {Object} payload - { email }
 * @returns {Promise<{ message: string }>}
 */
async function requestPasswordReset({ email } = {}) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    const err = new Error('Email is required');
    err.status = 400;
    throw err;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const pool = dbPool.getPool();

  const { rows } = await pool.query('SELECT * FROM app_user WHERE email = $1', [cleanEmail]);
  if (rows.length === 0) {
    return {
      message: 'If that email address is in our system, we have sent a password reset link to it.',
    };
  }

  const user = rows[0];
  const userId = user.userId ?? user.userid;

  // 1. Invalidate any previously unexpired tokens for this user
  await pool.query(
    `UPDATE password_reset_token
     SET isUsed = 1
     WHERE userId = $1 AND isUsed = 0 AND expiresAt > CURRENT_TIMESTAMP`,
    [userId]
  );

  // 2. Generate cryptographically secure random token (32 bytes hex = 64 characters)
  const rawToken = crypto.randomBytes(32).toString('hex');

  // 3. Calculate SHA-256 hash of the token
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 4. Save hashed token into password_reset_token with 1-hour expiration
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO password_reset_token (userId, tokenHash, expiresAt, isUsed)
     VALUES ($1, $2, $3, 0)`,
    [userId, tokenHash, expiresAt]
  );

  // 5. Send reset link (log to console in development)
  const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '';
  const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;
  console.log(`[auth] Password reset link for ${cleanEmail}: ${resetLink}`);

  return {
    message: 'If that email address is in our system, we have sent a password reset link to it.',
  };
}

/**
 * Reset user password (S1-DEV-04).
 * Validates submitted token, verifies against password_reset_token,
 * updates app_user passwordHash with bcrypt and audit stamp,
 * and marks token as used.
 * @param {Object} payload - { token, newPassword, confirmPassword, password }
 * @returns {Promise<{ message: string }>}
 */
async function resetPassword({ token, newPassword, confirmPassword, password } = {}) {
  if (!token || typeof token !== 'string' || !token.trim()) {
    const err = new Error('Invalid or expired password reset token');
    err.status = 400;
    throw err;
  }

  const passwordToSet = newPassword || password;
  if (!passwordToSet || typeof passwordToSet !== 'string') {
    const err = new Error('Password is required');
    err.status = 400;
    throw err;
  }

  if (passwordToSet.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.status = 400;
    throw err;
  }

  if (confirmPassword !== undefined && confirmPassword !== passwordToSet) {
    const err = new Error('Password and confirmPassword do not match');
    err.status = 400;
    throw err;
  }

  const cleanToken = token.trim();
  const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

  const pool = dbPool.getPool();

  // Check conditions: record exists, isUsed == FALSE, and expiresAt > NOW()
  const { rows } = await pool.query(
    'SELECT * FROM password_reset_token WHERE tokenHash = $1',
    [tokenHash]
  );

  if (rows.length === 0) {
    const err = new Error('Invalid or expired password reset token');
    err.status = 400;
    throw err;
  }

  const record = rows[0];
  const isUsed = record.isUsed ?? record.isused;
  const expiresAt = new Date(record.expiresAt ?? record.expiresat);
  const now = new Date();

  if (isUsed === 1 || isUsed === true || expiresAt <= now) {
    const err = new Error('Invalid or expired password reset token');
    err.status = 400;
    throw err;
  }

  const tokenId = record.id;
  const userId = record.userId ?? record.userid;

  // Atomically mark token as used
  const updateResult = await pool.query(
    `UPDATE password_reset_token
     SET isUsed = 1, usedAt = CURRENT_TIMESTAMP
     WHERE id = $1 AND isUsed = 0 AND expiresAt > CURRENT_TIMESTAMP`,
    [tokenId]
  );

  if (updateResult.rowCount === 0) {
    const err = new Error('Invalid or expired password reset token');
    err.status = 400;
    throw err;
  }

  // Update app_user passwordHash and stamp
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(passwordToSet, saltRounds);
  const stamp = `EDITED system (password reset) ${new Date().toISOString()}`;

  await pool.query(
    `UPDATE app_user
     SET passwordHash = $1, stamp = $2
     WHERE userId = $3`,
    [passwordHash, stamp, userId]
  );

  return { message: 'Password has been reset successfully' };
}

module.exports = {
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
};
