-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 002: User Management & RBAC Foundation
-- (Supabase / PostgreSQL)
-- ==============================================================================

-- 1. ROLE TABLE
CREATE TABLE IF NOT EXISTS "role" (
    "roleName" VARCHAR(20) PRIMARY KEY,
    "description" TEXT,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT'
);

-- 2. MODULE TABLE
CREATE TABLE IF NOT EXISTS "module" (
    "moduleCode" VARCHAR(30) PRIMARY KEY,
    "moduleName" VARCHAR(50) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT'
);

-- 3. RIGHTS CATALOGUE TABLE
CREATE TABLE IF NOT EXISTS "rights" (
    "rightCode" VARCHAR(50) PRIMARY KEY,
    "moduleCode" VARCHAR(30) NOT NULL,
    "description" VARCHAR(150) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    FOREIGN KEY ("moduleCode") REFERENCES "module" ("moduleCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. APP_USER TABLE
CREATE TABLE IF NOT EXISTS "app_user" (
    "userId" SERIAL PRIMARY KEY,
    "firstName" VARCHAR(50) NOT NULL,
    "lastName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL UNIQUE,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'User',
    "isBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
    "empNo" VARCHAR(10),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    FOREIGN KEY ("role") REFERENCES "role" ("roleName") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("empNo") REFERENCES "EMPLOYEE" ("empNo") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. USER_PERMISSION JUNCTION TABLE
CREATE TABLE IF NOT EXISTS "user_permission" (
    "userId" INTEGER NOT NULL,
    "rightCode" VARCHAR(50) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    PRIMARY KEY ("userId", "rightCode"),
    FOREIGN KEY ("userId") REFERENCES "app_user" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("rightCode") REFERENCES "rights" ("rightCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. PASSWORD RESET TOKEN TABLE
CREATE TABLE IF NOT EXISTS "password_reset_token" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY ("userId") REFERENCES "app_user" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(100),
    "details" JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_app_user_email" ON "app_user" ("email");
CREATE INDEX IF NOT EXISTS "idx_app_user_role" ON "app_user" ("role");
CREATE INDEX IF NOT EXISTS "idx_rights_moduleCode" ON "rights" ("moduleCode");
CREATE INDEX IF NOT EXISTS "idx_user_permission_user" ON "user_permission" ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_permission_right" ON "user_permission" ("rightCode");
