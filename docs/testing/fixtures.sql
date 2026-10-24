-- Sprint 1 disposable QA fixtures (PostgreSQL).
-- Prerequisite: apply the application's migrations first. The expected
-- conventions are app_user(email, password_hash, role, status, is_blocked,
-- stamp), role/user_permission, and password_reset_tokens(user_email).
-- Replace the bcrypt value below with the application's generated hash for
-- QaPassword!123; never use this seed in production.

BEGIN;

INSERT INTO app_user (email, password_hash, role, status, is_blocked, stamp)
VALUES
  ('qa.superadmin@hope.com',     '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'Superadmin', 'Active',   FALSE, 'CREATED qa-fixture'),
  ('qa.superadmin2@hope.com',    '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'Superadmin', 'Active',   FALSE, 'CREATED qa-fixture'),
  ('qa.admin@hope.com',          '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'Admin',      'Active',   FALSE, 'CREATED qa-fixture'),
  ('qa.admin.peer@hope.com',     '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'Admin',      'Active',   FALSE, 'CREATED qa-fixture'),
  ('qa.user@hope.com',           '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'User',       'Active',   FALSE, 'CREATED qa-fixture'),
  ('qa.user.norights@hope.com',  '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'User',       'Active',   FALSE, 'CREATED qa-fixture'),
  ('qa.blocked@hope.com',        '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'User',       'Active',   TRUE,  'CREATED qa-fixture'),
  ('qa.deleted@hope.com',        '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'User',       'Inactive', FALSE, 'DELETED qa-fixture')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  is_blocked = EXCLUDED.is_blocked,
  stamp = EXCLUDED.stamp;

-- Grant a deliberately small, auditable set. The full 36-right catalogue is
-- created by the rights migration; use its stable code values here.
INSERT INTO user_permission (user_email, right_code)
VALUES
  ('qa.user@hope.com', 'dashboard.view'),
  ('qa.user@hope.com', 'customer.view'),
  ('qa.admin@hope.com', 'user.view'),
  ('qa.admin@hope.com', 'user.create'),
  ('qa.admin@hope.com', 'user.edit'),
  ('qa.admin@hope.com', 'user.block'),
  ('qa.admin@hope.com', 'rights.view'),
  ('qa.admin@hope.com', 'rights.assign')
ON CONFLICT DO NOTHING;

DELETE FROM password_reset_tokens
WHERE user_email IN (
  'qa.superadmin@hope.com', 'qa.superadmin2@hope.com',
  'qa.admin@hope.com', 'qa.admin.peer@hope.com', 'qa.user@hope.com',
  'qa.user.norights@hope.com', 'qa.blocked@hope.com', 'qa.deleted@hope.com'
);

COMMIT;
