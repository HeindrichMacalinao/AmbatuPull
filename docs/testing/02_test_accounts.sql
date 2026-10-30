-- Sprint 1 QA test-only account fixture.
-- SQLite-compatible SQL; run after 01_test_roles_and_rights.sql.
-- All accounts use the password QaPassword!123.
-- The bcrypt cost-12 hash is for disposable local/CI testing only.

BEGIN;

-- Seed one account per role plus peer, blocked, inactive, and no-rights cases.
INSERT INTO app_user (firstName, lastName, email, passwordHash, role, status, isBlocked, stamp)
VALUES
  ('QA', 'Superadmin', 'test_superadmin@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'Superadmin', 'Active', 0, 'CREATED test_seed'),
  ('QA', 'Superadmin Second', 'test_superadmin.second@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'Superadmin', 'Active', 0, 'CREATED test_seed'),
  ('QA', 'Admin', 'test_admin@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'Admin', 'Active', 0, 'CREATED test_seed'),
  ('QA', 'Admin Peer', 'test_admin.peer@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'Admin', 'Active', 0, 'CREATED test_seed'),
  ('QA', 'User', 'test_user@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'User', 'Active', 0, 'CREATED test_seed'),
  ('QA', 'User No Rights', 'test_user.norights@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'User', 'Active', 0, 'CREATED test_seed'),
  ('QA', 'Blocked User', 'test_blocked@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'User', 'Active', 1, 'CREATED test_seed'),
  ('QA', 'Deleted User', 'test_deleted@hope.com', '$2b$12$Nj.ZsDDcN/vHc2VzC6MLYesBwH/yanA6ZQY2cx/O9r9fZgMhJFE96', 'User', 'Inactive', 0, 'DELETED test_seed')
ON CONFLICT (email) DO UPDATE
SET passwordHash = excluded.passwordHash,
    firstName = excluded.firstName,
    lastName = excluded.lastName,
    role = excluded.role,
    status = excluded.status,
    isBlocked = excluded.isBlocked,
    stamp = excluded.stamp;

-- Grant representative rights to the positive User fixture.
-- Replace any prior grants so repeated seeds cannot retain stale permissions.
DELETE FROM user_permission
WHERE "userId" = (
  SELECT "userId" FROM app_user WHERE email = 'test_user@hope.com'
);

INSERT INTO user_permission ("userId", "rightCode", "status", "stamp")
VALUES
  ((SELECT "userId" FROM app_user WHERE email = 'test_user@hope.com'), 'customer.view', 'Active', 'GRANTED test_seed')
ON CONFLICT ("userId", "rightCode") DO UPDATE
SET "status" = excluded."status",
    "stamp" = excluded."stamp";

-- Keep the no-rights fixture deterministic across repeated seed runs.
DELETE FROM user_permission
WHERE "userId" = (SELECT "userId" FROM app_user WHERE email = 'test_user.norights@hope.com');

COMMIT;
