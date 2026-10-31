-- S1-DBA-04 | HOPE ERP password-reset token storage | SQLite 3
-- Depends on db/migrations/002_user_management_tables.sql (app_user.userId).
-- No tokens are generated or seeded by this migration.
-- Token generation, SHA-256 hashing and authenticated reset processing belong
-- in the application; the database stores only 64-character lowercase digests.
-- For expiry/one-time checks use an atomic guarded UPDATE in the application.
-- PRAGMA foreign_keys must be ON for every SQLite application connection.

PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "password_reset_token" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL
        CHECK (length("tokenHash") = 64
            AND "tokenHash" NOT GLOB '*[^0-9a-f]*'),
    "expiresAt" TIMESTAMP NOT NULL DEFAULT (datetime('now', '+1 hour')),
    "isUsed" BOOLEAN NOT NULL DEFAULT 0
        CHECK ("isUsed" IN (0, 1)),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP NULL,
    FOREIGN KEY ("userId") REFERENCES "app_user" ("userId")
        ON UPDATE CASCADE ON DELETE CASCADE,
    -- Deterministic date validation: no 'now' in a CHECK constraint.
    CHECK (datetime("createdAt") IS NOT NULL
        AND datetime("expiresAt") IS NOT NULL
        AND julianday("expiresAt") > julianday("createdAt")),
    CHECK ("usedAt" IS NULL OR datetime("usedAt") IS NOT NULL)
);

-- A digest must identify at most one reset request. This unique index also
-- satisfies the requested fast tokenHash lookup index.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_password_reset_token_tokenHash"
    ON "password_reset_token" ("tokenHash");

-- Supports locating active/pending tokens by user, used state, expiry.
CREATE INDEX IF NOT EXISTS "idx_password_reset_token_user_state_expiry"
    ON "password_reset_token" ("userId", "isUsed", "expiresAt");

COMMIT;
