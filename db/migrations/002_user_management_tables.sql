-- S1-DBA-03 | HOPE ERP user-management schema | SQLite 3
-- Requires S1-DBA-02 (db/migrations/001_hope_base_tables.sql) for EMPLOYEE.
-- Existing HOPE business tables/records are not changed.
-- SQLite FK enforcement is connection-scoped: PRAGMA foreign_keys = ON;
-- Password hashing and authorization decisions are application responsibilities.
-- DO NOT seed demo accounts/permissions or invent the 36 application rights here.
-- This migration is safe to re-apply to an unchanged, compatible schema.

PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- Stable role names are required by app_user.role's FK.  These are the only
-- three values specified by task S1-DBA-03; no fabricated user records.
CREATE TABLE IF NOT EXISTS "role" (
    "roleName" VARCHAR(20) PRIMARY KEY
        CHECK ("roleName" IN ('Superadmin', 'Admin', 'User')),
    "description" TEXT
);
INSERT INTO "role" ("roleName") VALUES ('Superadmin')
    ON CONFLICT("roleName") DO NOTHING;
INSERT INTO "role" ("roleName") VALUES ('Admin')
    ON CONFLICT("roleName") DO NOTHING;
INSERT INTO "role" ("roleName") VALUES ('User')
    ON CONFLICT("roleName") DO NOTHING;

-- SQLite INTEGER PRIMARY KEY AUTOINCREMENT creates sequential IDs; callers
-- never provide a password in plain text. passwordHash is storage-only.
-- COLLATE NOCASE makes email uniqueness case-insensitive for ASCII email
-- spellings. Normalize email in the application before persisting it.
CREATE TABLE IF NOT EXISTS "app_user" (
    "userId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "firstName" VARCHAR(50) NOT NULL
        CHECK (length(trim("firstName")) BETWEEN 1 AND 50),
    "lastName" VARCHAR(50) NOT NULL
        CHECK (length(trim("lastName")) BETWEEN 1 AND 50),
    "email" VARCHAR(100) COLLATE NOCASE NOT NULL UNIQUE
        CHECK (length(trim("email")) BETWEEN 1 AND 100
            AND "email" = trim("email")),
    "passwordHash" VARCHAR(255) NOT NULL
        CHECK (length("passwordHash") BETWEEN 1 AND 255),
    "role" VARCHAR(20) NOT NULL DEFAULT 'User'
        CHECK ("role" IN ('Superadmin', 'Admin', 'User')),
    "isBlocked" BOOLEAN NOT NULL DEFAULT 0
        CHECK ("isBlocked" IN (0, 1)),
    "empNo" VARCHAR(10) NULL
        CHECK ("empNo" IS NULL OR length("empNo") BETWEEN 1 AND 10),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
        CHECK (length(trim("stamp")) BETWEEN 1 AND 80),
    FOREIGN KEY ("role") REFERENCES "role" ("roleName")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Link to the EMPLOYEE base table added by S1-DBA-02.
    -- EMPLOYEE removal unlinks the account; it does not delete the account.
    FOREIGN KEY ("empNo") REFERENCES "EMPLOYEE" ("empNo")
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "module" (
    "moduleCode" VARCHAR(30) PRIMARY KEY
        CHECK (length(trim("moduleCode")) BETWEEN 1 AND 30),
    "moduleName" VARCHAR(50)
        CHECK ("moduleName" IS NULL OR length("moduleName") <= 50)
);

CREATE TABLE IF NOT EXISTS "rights" (
    "rightCode" VARCHAR(50) PRIMARY KEY
        CHECK (length(trim("rightCode")) BETWEEN 1 AND 50),
    "moduleCode" VARCHAR(30) NOT NULL,
    "description" VARCHAR(150) NOT NULL
        CHECK (length(trim("description")) BETWEEN 1 AND 150),
    FOREIGN KEY ("moduleCode") REFERENCES "module" ("moduleCode")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Cascading physical deletes keep the junction table free of orphans.
-- For ordinary account deactivation use app_user.isBlocked or status;
-- for a revoked grant use user_permission.status = 'Inactive'.
-- Those soft changes retain the row; they do not cascade.
CREATE TABLE IF NOT EXISTS "user_permission" (
    "userId" INTEGER NOT NULL,
    "rightCode" VARCHAR(50) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
        CHECK (length(trim("stamp")) BETWEEN 1 AND 80),
    PRIMARY KEY ("userId", "rightCode"),
    FOREIGN KEY ("userId") REFERENCES "app_user" ("userId")
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY ("rightCode") REFERENCES "rights" ("rightCode")
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- Explicit indexes requested by issue #8, in addition to the automatic
-- UNIQUE index on email and the junction composite-key index.
CREATE INDEX IF NOT EXISTS "idx_app_user_email" ON "app_user" ("email");
CREATE INDEX IF NOT EXISTS "idx_user_permission_userId" ON "user_permission" ("userId");

COMMIT;
