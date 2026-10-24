-- Disposable Sprint 1 QA fixtures. Replace the password hashes with the
-- application's bcrypt output when integrating this seed with a real schema.
INSERT INTO users (email, password_hash, role, is_blocked)
VALUES
  ('qa.superadmin@hope.com', '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'Superadmin', 0),
  ('qa.admin@hope.com',      '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'Admin',      0),
  ('qa.user@hope.com',       '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'User',       0),
  ('qa.blocked@hope.com',    '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'User',       1)
ON CONFLICT (email) DO UPDATE SET
  role = excluded.role,
  is_blocked = excluded.is_blocked;

-- Use a disposable password reset token for reset-flow tests.
DELETE FROM password_reset_tokens
WHERE user_email IN (
  'qa.superadmin@hope.com',
  'qa.admin@hope.com',
  'qa.user@hope.com',
  'qa.blocked@hope.com'
);
