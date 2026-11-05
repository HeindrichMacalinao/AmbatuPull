-- S1-DBA-06 | Auditing app_user, user_permission and rights | SQLite 3.
-- Prerequisite: S1-DBA-03 (002_user_management_tables.sql).
-- A trusted, non-deterministic audit_user() SQL function MUST be registered on
-- EVERY writing connection. Missing actor/function => audited mutations abort.
-- Application code must never derive the actor from client-supplied headers.
-- Details deliberately exclude passwordHash and reset tokens.
-- The legacy rights table has no stamp column; its changes are audit-logged.
-- SQLite timestamps are UTC. CREATE TRIGGER IF NOT EXISTS is re-applicable.

PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "performedBy" VARCHAR(100) NOT NULL
        CHECK (length(trim("performedBy")) BETWEEN 1 AND 100),
    "action" VARCHAR(50) NOT NULL
        CHECK ("action" IN ('CREATED','EDITED','DELETED','RESTORED',
                           'RIGHTS_UPDATED','BLOCKED','UNBLOCKED')),
    "tableName" VARCHAR(50) NOT NULL,
    "recordId" VARCHAR(50) NOT NULL,
    "details" TEXT CHECK ("details" IS NULL OR json_valid("details")),
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_audit_log_record_time"
    ON "audit_log" ("tableName", "recordId", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_audit_log_actor_time"
    ON "audit_log" ("performedBy", "timestamp");

-- Guard accidental history edits and prevent wrong-actor inserts.
-- These protections assume application connections cannot issue schema DDL;
-- SQLite file owners can ultimately modify/drop triggers and audit rows.
CREATE TRIGGER IF NOT EXISTS "trg_audit_log_actor_insert"
BEFORE INSERT ON "audit_log"
BEGIN
    SELECT CASE WHEN NEW."performedBy" IS NOT audit_user()
        THEN RAISE(ABORT, 'audit actor mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_log_no_update"
BEFORE UPDATE ON "audit_log"
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS "trg_audit_log_no_delete"
BEFORE DELETE ON "audit_log"
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

-- app_user: never serialize passwordHash into audit_log.
-- INSERT caller supplies a nonempty placeholder stamp required by the old
-- schema; the trigger replaces it with the trusted audit stamp.
CREATE TRIGGER IF NOT EXISTS "trg_app_user_audit_insert"
AFTER INSERT ON "app_user"
BEGIN
    UPDATE "app_user" SET "stamp" = printf('CREATED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE "userId" = NEW."userId";
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'CREATED', 'app_user', CAST(NEW."userId" AS TEXT), json_object('before', NULL, 'after', json_object('userId', NEW."userId", 'firstName', NEW."firstName", 'lastName', NEW."lastName", 'email', NEW."email", 'role', NEW."role", 'isBlocked', NEW."isBlocked", 'empNo', NEW."empNo", 'status', NEW."status")));
END;
-- Action precedence for a combined update: BLOCKED/UNBLOCKED,
-- then DELETED/RESTORED, otherwise EDITED. Full state is always included.
CREATE TRIGGER IF NOT EXISTS "trg_app_user_audit_update"
AFTER UPDATE OF "userId", "firstName", "lastName", "email", "passwordHash", "role", "isBlocked", "empNo", "status" ON "app_user"
BEGIN
    UPDATE "app_user" SET "stamp" =
        printf('%s %s %s', (CASE
        WHEN OLD."isBlocked" = 0 AND NEW."isBlocked" = 1 THEN 'BLOCKED'
        WHEN OLD."isBlocked" = 1 AND NEW."isBlocked" = 0 THEN 'UNBLOCKED'
        WHEN OLD."status" = 'Active' AND NEW."status" = 'Inactive' THEN 'DELETED'
        WHEN OLD."status" = 'Inactive' AND NEW."status" = 'Active' THEN 'RESTORED'
        ELSE 'EDITED' END), audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now'))
        WHERE "userId" = NEW."userId";
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), (CASE
        WHEN OLD."isBlocked" = 0 AND NEW."isBlocked" = 1 THEN 'BLOCKED'
        WHEN OLD."isBlocked" = 1 AND NEW."isBlocked" = 0 THEN 'UNBLOCKED'
        WHEN OLD."status" = 'Active' AND NEW."status" = 'Inactive' THEN 'DELETED'
        WHEN OLD."status" = 'Inactive' AND NEW."status" = 'Active' THEN 'RESTORED'
        ELSE 'EDITED' END), 'app_user', CAST(NEW."userId" AS TEXT), json_object('before', json_object('userId', OLD."userId", 'firstName', OLD."firstName", 'lastName', OLD."lastName", 'email', OLD."email", 'role', OLD."role", 'isBlocked', OLD."isBlocked", 'empNo', OLD."empNo", 'status', OLD."status"), 'after', json_object('userId', NEW."userId", 'firstName', NEW."firstName", 'lastName', NEW."lastName", 'email', NEW."email", 'role', NEW."role", 'isBlocked', NEW."isBlocked", 'empNo', NEW."empNo", 'status', NEW."status"), 'passwordHashChanged', OLD."passwordHash" IS NOT NEW."passwordHash"));
END;
CREATE TRIGGER IF NOT EXISTS "trg_app_user_audit_delete"
AFTER DELETE ON "app_user"
BEGIN
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'DELETED', 'app_user', CAST(OLD."userId" AS TEXT), json_object('before', json_object('userId', OLD."userId", 'firstName', OLD."firstName", 'lastName', OLD."lastName", 'email', OLD."email", 'role', OLD."role", 'isBlocked', OLD."isBlocked", 'empNo', OLD."empNo", 'status', OLD."status"), 'after', NULL));
END;
-- A direct UPDATE of only the stamp column is logged and replaced.
-- The internally generated stamp updates are ignored; their values are
-- calculated in the same sqlite3_step() so SQLite now() is consistent.
CREATE TRIGGER IF NOT EXISTS "trg_app_user_audit_stamp_only"
AFTER UPDATE OF "stamp" ON "app_user"
WHEN OLD."stamp" IS NOT NEW."stamp"
    AND OLD."userId" IS NEW."userId" AND OLD."firstName" IS NEW."firstName" AND OLD."lastName" IS NEW."lastName" AND OLD."email" IS NEW."email" AND OLD."passwordHash" IS NEW."passwordHash" AND OLD."role" IS NEW."role" AND OLD."isBlocked" IS NEW."isBlocked" AND OLD."empNo" IS NEW."empNo" AND OLD."status" IS NEW."status"
    AND NEW."stamp" IS NOT printf('CREATED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) AND NEW."stamp" IS NOT printf('EDITED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) AND NEW."stamp" IS NOT printf('DELETED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) AND NEW."stamp" IS NOT printf('RESTORED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) AND NEW."stamp" IS NOT printf('BLOCKED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) AND NEW."stamp" IS NOT printf('UNBLOCKED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now'))
BEGIN
    UPDATE "app_user" SET "stamp" = printf('EDITED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE "userId" = NEW."userId";
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'EDITED', 'app_user', CAST(NEW."userId" AS TEXT), json_object('before', json_object('userId', OLD."userId", 'firstName', OLD."firstName", 'lastName', OLD."lastName", 'email', OLD."email", 'role', OLD."role", 'isBlocked', OLD."isBlocked", 'empNo', OLD."empNo", 'status', OLD."status"), 'after', json_object('userId', NEW."userId", 'firstName', NEW."firstName", 'lastName', NEW."lastName", 'email', NEW."email", 'role', NEW."role", 'isBlocked', NEW."isBlocked", 'empNo', NEW."empNo", 'status', NEW."status"), 'stampOnlyCorrection', 1));
END;
-- user_permission: the grant/revoke identity is (userId,rightCode).
-- All mutations are RIGHTS_UPDATED, with before/after grant states.
-- recordId uses the user ID; rightCode remains in details.
CREATE TRIGGER IF NOT EXISTS "trg_user_permission_audit_insert"
AFTER INSERT ON "user_permission"
BEGIN
    UPDATE "user_permission" SET "stamp" = printf('RIGHTS_UPDATED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE "userId" = NEW."userId" AND "rightCode" = NEW."rightCode";
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'RIGHTS_UPDATED', 'user_permission', CAST(NEW."userId" AS TEXT), json_object('before', NULL, 'after', json_object('userId', NEW."userId", 'rightCode', NEW."rightCode", 'status', NEW."status")));
END;
CREATE TRIGGER IF NOT EXISTS "trg_user_permission_audit_update"
AFTER UPDATE OF "userId", "rightCode", "status" ON "user_permission"
BEGIN
    UPDATE "user_permission" SET "stamp" = printf('RIGHTS_UPDATED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE "userId" = NEW."userId" AND "rightCode" = NEW."rightCode";
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'RIGHTS_UPDATED', 'user_permission', CAST(NEW."userId" AS TEXT), json_object('before', json_object('userId', OLD."userId", 'rightCode', OLD."rightCode", 'status', OLD."status"), 'after', json_object('userId', NEW."userId", 'rightCode', NEW."rightCode", 'status', NEW."status")));
END;
CREATE TRIGGER IF NOT EXISTS "trg_user_permission_audit_delete"
AFTER DELETE ON "user_permission"
BEGIN
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'RIGHTS_UPDATED', 'user_permission', CAST(OLD."userId" AS TEXT), json_object('before', json_object('userId', OLD."userId", 'rightCode', OLD."rightCode", 'status', OLD."status"), 'after', NULL));
END;
CREATE TRIGGER IF NOT EXISTS "trg_user_permission_audit_stamp_only"
AFTER UPDATE OF "stamp" ON "user_permission"
WHEN OLD."stamp" IS NOT NEW."stamp"
    AND OLD."userId" IS NEW."userId"
    AND OLD."rightCode" IS NEW."rightCode"
    AND OLD."status" IS NEW."status"
    AND NEW."stamp" IS NOT printf('RIGHTS_UPDATED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now'))
BEGIN
    UPDATE "user_permission" SET "stamp" = printf('RIGHTS_UPDATED %s %s', audit_user(), strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE "userId" = NEW."userId" AND "rightCode" = NEW."rightCode";
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'RIGHTS_UPDATED', 'user_permission', CAST(NEW."userId" AS TEXT), json_object('before', json_object('userId', OLD."userId", 'rightCode', OLD."rightCode", 'status', OLD."status"), 'after', json_object('userId', NEW."userId", 'rightCode', NEW."rightCode", 'status', NEW."status"), 'stampOnlyCorrection', 1));
END;
-- Changes to the permission catalog itself are also audited.
-- The S1-DBA-03 rights table has no stamp column; no schema rewrite here.
CREATE TRIGGER IF NOT EXISTS "trg_rights_audit_insert"
AFTER INSERT ON "rights"
BEGIN
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'CREATED', 'rights', NEW."rightCode", json_object('before', NULL, 'after', json_object('rightCode', NEW."rightCode", 'moduleCode', NEW."moduleCode", 'description', NEW."description")));
END;
CREATE TRIGGER IF NOT EXISTS "trg_rights_audit_update"
AFTER UPDATE OF "rightCode", "moduleCode", "description" ON "rights"
BEGIN
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'EDITED', 'rights', NEW."rightCode", json_object('before', json_object('rightCode', OLD."rightCode", 'moduleCode', OLD."moduleCode", 'description', OLD."description"), 'after', json_object('rightCode', NEW."rightCode", 'moduleCode', NEW."moduleCode", 'description', NEW."description")));
END;
CREATE TRIGGER IF NOT EXISTS "trg_rights_audit_delete"
AFTER DELETE ON "rights"
BEGIN
    INSERT INTO "audit_log" ("performedBy","action","tableName","recordId","details")
    VALUES (audit_user(), 'DELETED', 'rights', OLD."rightCode", json_object('before', json_object('rightCode', OLD."rightCode", 'moduleCode', OLD."moduleCode", 'description', OLD."description"), 'after', NULL));
END;

COMMIT;
