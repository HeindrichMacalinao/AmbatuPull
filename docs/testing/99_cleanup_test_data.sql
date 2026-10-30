-- Sprint 1 QA test-only fixture cleanup.
-- SQLite-compatible SQL; documentation only for a future disposable DB.
-- This file is not executed by this task.

BEGIN;

-- Remove permissions belonging to test-prefixed accounts.
DELETE FROM user_permission
WHERE "userId" IN (
  SELECT "userId" FROM app_user
  WHERE email LIKE 'test\_%' ESCAPE '\'
);

-- Remove only test-prefixed accounts.
DELETE FROM app_user
WHERE email LIKE 'test\_%' ESCAPE '\';

-- Rights and modules are shared/canonical data and are intentionally preserved.
-- DevSecOps must confirm the authoritative catalog before this fixture is used
-- against an application database; this fixture does not claim ownership.
-- Shared roles are also intentionally preserved.
-- Reset-token/session cleanup is intentionally absent because those table
-- names and columns are not present in the repository.

COMMIT;
