'use strict';

const { getPool } = require('../db/pool');
const bcrypt = require('bcryptjs');
const { loginUser, logoutUser } = require('../services/authService');

// Simple email regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Register a new user.
 * Validates input, hashes password with bcryptjs (cost 10), and inserts into the app_user table.
 * Enforces default role "User" regardless of any client‑provided role.
 */
async function registerUser(req, res) {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    // ----- Validation -----
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and confirmPassword do not match' });
    }

    const pool = getPool();

    // Check for existing email (case‑insensitive due to COLLATE NOCASE in schema)
    const existing = await pool.query('SELECT 1 FROM app_user WHERE email = $1', [cleanEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user – role is forced to 'User' per requirement
    const result = await pool.query(
      `INSERT INTO app_user (firstName, lastName, email, passwordHash, role, isBlocked, status, stamp)
       VALUES ($1, $2, $3, $4, 'User', 0, 'Active', $5)
       RETURNING userId, firstName, lastName, email, role, isBlocked, status, stamp`,
      [
        firstName.trim(),
        lastName.trim(),
        cleanEmail,
        passwordHash,
        `CREATED self ${new Date().toISOString()}`,
      ]
    );

    const newUser = result.rows[0];
    // Do not return passwordHash
    return res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('[registerUser] error:', err);
    // If the error is a duplicate key (should have been caught above), map to 409
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);
    // Issue an httpOnly session cookie for QA contract tests & web security
    res.cookie('token', result.token, { httpOnly: true, sameSite: 'lax' });
    res.status(200).json({ token: result.token, user: result.user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    await logoutUser();
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerUser, login, logout };
