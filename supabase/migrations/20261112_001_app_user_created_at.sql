-- Ensure registration can safely return and persist the account creation time.
-- This is idempotent for projects that partially applied the earlier migration.

ALTER TABLE public."app_user"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ;

UPDATE public."app_user"
SET "createdAt" = CURRENT_TIMESTAMP
WHERE "createdAt" IS NULL;

ALTER TABLE public."app_user"
    ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "createdAt" SET NOT NULL;

-- Refresh PostgREST's schema cache so the Next.js registration route sees the
-- column immediately after the migration is applied.
NOTIFY pgrst, 'reload schema';
