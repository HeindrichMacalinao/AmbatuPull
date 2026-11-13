-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 004: Add createdAt to app_user and refresh PostgREST schema cache
-- (Supabase / PostgreSQL)
-- ==============================================================================

ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

NOTIFY pgrst, 'reload schema';
