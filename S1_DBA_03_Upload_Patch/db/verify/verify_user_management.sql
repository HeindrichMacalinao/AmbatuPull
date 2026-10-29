-- S1-DBA-03 | Read-only structural verification for SQLite.
-- Run after migrations 001 + 002. Detailed negative tests in
-- tests/verify_user_management.py (which rolls back all test rows).
PRAGMA foreign_keys = ON;
PRAGMA integrity_check;          -- expected: ok
PRAGMA foreign_key_check;       -- expected: zero rows

SELECT name AS user_management_table FROM sqlite_master
WHERE type='table' AND name IN ('app_user','role','module','rights','user_permission')
ORDER BY name;                   -- expected: five rows

SELECT roleName FROM "role" ORDER BY roleName;
-- expected: Admin, Superadmin, User

SELECT name, tbl_name FROM sqlite_master WHERE type='index'
AND name IN ('idx_app_user_email','idx_user_permission_userId')
ORDER BY name;                   -- expected: two rows

SELECT 'app_user' AS tbl, "from" AS column_name, "table" AS target_table,
       "to" AS target_column, on_delete FROM pragma_foreign_key_list('app_user')
UNION ALL
SELECT 'rights',"from","table","to",on_delete FROM pragma_foreign_key_list('rights')
UNION ALL
SELECT 'user_permission',"from","table","to",on_delete FROM pragma_foreign_key_list('user_permission');
-- expected: five foreign keys in total; user_permission's two FKs CASCADE.

SELECT 'app_user' AS tbl, COUNT(*) AS rows FROM app_user
UNION ALL SELECT 'role', COUNT(*) FROM "role"
UNION ALL SELECT 'module', COUNT(*) FROM "module"
UNION ALL SELECT 'rights', COUNT(*) FROM "rights"
UNION ALL SELECT 'user_permission', COUNT(*) FROM "user_permission";
-- expected on new install: 0, 3, 0, 0, 0.
