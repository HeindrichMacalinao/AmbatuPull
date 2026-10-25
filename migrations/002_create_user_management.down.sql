-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 002 Rollback: User Management & RBAC
-- Task ID: S1-DBA-01 / S1-DBA-03 / S1-DBA-04 (Issue #6, #8, #9)
-- ==============================================================================

DROP TABLE IF EXISTS password_reset_token;
DROP TABLE IF EXISTS user_permission;
DROP TABLE IF EXISTS rights;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS module;
DROP TABLE IF EXISTS role;
