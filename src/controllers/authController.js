'use strict';

const { getPool } = require('../db/pool');
const bcrypt = require('bcrypt'); // bcrypt should be installed as a dependency

// Simple email regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Register a new user.
 * Validates input, hashes password with bcrypt (cost 10), and inserts into the app_user table.
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

module.exports = { registerUser };
