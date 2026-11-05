'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const poolModule = require('../src/db/pool');
const {
  requestPasswordReset,
  resetPassword,
} = require('../src/services/authService');
const { createApp } = require('../src/app');

// Mock pool infrastructure for testing service logic in isolation
let mockQueries = [];
let queryHandler = null;

const fakePool = {
  query: async (sql, params = []) => {
    mockQueries.push({ sql, params });
    if (queryHandler) {
      return queryHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  },
};

let originalGetPool;

beforeEach(() => {
  mockQueries = [];
  queryHandler = null;
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

test('requestPasswordReset requires an email', async () => {
  await assert.rejects(
    () => requestPasswordReset({}),
    (err) => err.status === 400 && err.message === 'Email is required'
  );

  await assert.rejects(
    () => requestPasswordReset({ email: '   ' }),
    (err) => err.status === 400 && err.message === 'Email is required'
  );
});

test('requestPasswordReset returns generic success message when email does not exist (no account enumeration)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM app_user WHERE email')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  const res = await requestPasswordReset({ email: 'unknown@example.com' });
  assert.equal(
    res.message,
    'If that email address is in our system, we have sent a password reset link to it.'
  );
  // Ensure no reset tokens were inserted
  const insertQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO password_reset_token'));
  assert.equal(insertQuery, undefined, 'No token should be inserted for nonexistent user');
});

test('requestPasswordReset generates SHA-256 token, invalidates prior tokens, and persists hash', async () => {
  const fakeUser = { userId: 42, email: 'user@hope.com' };

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM app_user WHERE email')) {
      return { rows: [fakeUser], rowCount: 1 };
    }
    if (sql.includes('UPDATE password_reset_token')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO password_reset_token')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const res = await requestPasswordReset({ email: 'USER@Hope.COM' });
  assert.equal(
    res.message,
    'If that email address is in our system, we have sent a password reset link to it.'
  );

  // Check normalization
  const selectQuery = mockQueries.find((q) => q.sql.includes('SELECT * FROM app_user'));
  assert.equal(selectQuery.params[0], 'user@hope.com');

  // Check invalidation of previous unexpired tokens
  const invalidateQuery = mockQueries.find((q) => q.sql.includes('UPDATE password_reset_token'));
  assert.ok(invalidateQuery, 'Must execute invalidation query for user');
  assert.equal(invalidateQuery.params[0], 42);

  // Check token insert
  const insertQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO password_reset_token'));
  assert.ok(insertQuery, 'Must insert new token record');
  assert.equal(insertQuery.params[0], 42); // userId

  const tokenHash = insertQuery.params[1];
  assert.equal(typeof tokenHash, 'string');
  assert.equal(tokenHash.length, 64, 'tokenHash must be 64-char SHA-256 hex digest');
  assert.match(tokenHash, /^[0-9a-f]{64}$/, 'tokenHash must be lowercase hex');

  const expiresAt = insertQuery.params[2];
  assert.ok(expiresAt instanceof Date, 'expiresAt must be a Date object');
  const diffMinutes = (expiresAt.getTime() - Date.now()) / (1000 * 60);
  assert.ok(diffMinutes >= 59 && diffMinutes <= 61, 'Token must expire in 1 hour');
});

test('resetPassword validates token and password input parameters', async () => {
  await assert.rejects(
    () => resetPassword({}),
    (err) => err.status === 400 && err.message === 'Invalid or expired password reset token'
  );

  await assert.rejects(
    () => resetPassword({ token: 'abc' }),
    (err) => err.status === 400 && err.message === 'Password is required'
  );

  await assert.rejects(
    () => resetPassword({ token: 'abc', newPassword: 'short' }),
    (err) => err.status === 400 && err.message === 'Password must be at least 8 characters'
  );

  await assert.rejects(
    () => resetPassword({ token: 'abc', newPassword: 'Password123!', confirmPassword: 'Different123!' }),
    (err) => err.status === 400 && err.message === 'Password and confirmPassword do not match'
  );
});

test('resetPassword rejects nonexistent, expired, or already-used token', async () => {
  // Case 1: Nonexistent token
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM password_reset_token')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () => resetPassword({ token: 'unknown-token', newPassword: 'NewPassword123!' }),
    (err) => err.status === 400 && err.message === 'Invalid or expired password reset token'
  );

  // Case 2: Already-used token
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM password_reset_token')) {
      return {
        rows: [
          {
            id: 1,
            userId: 10,
            isUsed: 1,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () => resetPassword({ token: 'used-token', newPassword: 'NewPassword123!' }),
    (err) => err.status === 400 && err.message === 'Invalid or expired password reset token'
  );

  // Case 3: Expired token
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM password_reset_token')) {
      return {
        rows: [
          {
            id: 2,
            userId: 10,
            isUsed: 0,
            expiresAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () => resetPassword({ token: 'expired-token', newPassword: 'NewPassword123!' }),
    (err) => err.status === 400 && err.message === 'Invalid or expired password reset token'
  );
});

test('resetPassword successfully updates user password and marks token used', async () => {
  const rawToken = 'test-token-value-1234567890abcdef';
  const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM password_reset_token WHERE tokenHash = $1')) {
      assert.equal(params[0], expectedHash, 'Query must look up SHA-256 hash of submitted token');
      return {
        rows: [
          {
            id: 7,
            userId: 55,
            tokenHash: expectedHash,
            isUsed: 0,
            expiresAt: new Date(Date.now() + 1800000).toISOString(),
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE password_reset_token')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('UPDATE app_user')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const res = await resetPassword({
    token: rawToken,
    newPassword: 'MyNewSecurePassword!2026',
    confirmPassword: 'MyNewSecurePassword!2026',
  });

  assert.equal(res.message, 'Password has been reset successfully');

  // Verify token was marked used
  const updateToken = mockQueries.find((q) => q.sql.includes('UPDATE password_reset_token'));
  assert.ok(updateToken, 'Must update password_reset_token');
  assert.equal(updateToken.params[0], 7);

  // Verify app_user was updated
  const updateUser = mockQueries.find((q) => q.sql.includes('UPDATE app_user'));
  assert.ok(updateUser, 'Must update app_user');
  const [newPasswordHash, stamp, userId] = updateUser.params;
  assert.equal(userId, 55);
  assert.ok(await bcrypt.compare('MyNewSecurePassword!2026', newPasswordHash), 'bcrypt hash must match new password');
  assert.match(stamp, /^EDITED system \(password reset\) \d{4}-\d{2}-\d{2}T/, 'Audit stamp must conform to spec');
});

test('resetPassword works with { token, password } payload alias', async () => {
  const rawToken = 'test-token-alias';
  const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM password_reset_token WHERE tokenHash = $1')) {
      return {
        rows: [
          {
            id: 8,
            userId: 99,
            tokenHash: expectedHash,
            isUsed: 0,
            expiresAt: new Date(Date.now() + 1800000).toISOString(),
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE password_reset_token') || sql.includes('UPDATE app_user')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const res = await resetPassword({
    token: rawToken,
    password: 'AliasPassword!123',
  });

  assert.equal(res.message, 'Password has been reset successfully');
});

test('HTTP endpoints for forgot-password and reset-password work over express app', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM app_user WHERE email')) {
      return { rows: [{ userId: 1, email: 'test@hope.com' }], rowCount: 1 };
    }
    if (sql.includes('UPDATE password_reset_token') || sql.includes('INSERT INTO password_reset_token')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. POST /api/auth/forgot-password
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@hope.com' }),
    });
    assert.equal(forgotRes.status, 200);
    const forgotJson = await forgotRes.json();
    assert.match(forgotJson.message, /password reset link/);

    // 2. Alias: POST /api/auth/password-reset/request
    const aliasForgotRes = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@hope.com' }),
    });
    assert.equal(aliasForgotRes.status, 200);

    // 3. POST /api/auth/reset-password with invalid token returns 400
    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid-token',
        newPassword: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      }),
    });
    assert.equal(resetRes.status, 400);
    const resetJson = await resetRes.json();
    assert.equal(resetJson.error, 'Invalid or expired password reset token');

    // 4. Alias: POST /api/auth/password-reset/complete
    const aliasResetRes = await fetch(`${baseUrl}/api/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid-token',
        password: 'ValidPassword123!',
      }),
    });
    assert.equal(aliasResetRes.status, 400);
  } finally {
    server.close();
  }
});
