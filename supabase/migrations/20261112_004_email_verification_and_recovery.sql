-- AmbatuPull: custom app_user authentication, email confirmation, atomic password recovery.
-- Run once in Supabase SQL editor / migrations BEFORE deploying corresponding Next.js routes.
-- Existing users remain UNVERIFIED until their email ownership is confirmed; do not
-- auto-verify imported accounts without the owner's approval.
BEGIN;
ALTER TABLE public."app_user" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamptz;
ALTER TABLE public."app_user" ADD COLUMN IF NOT EXISTS "sessionRevokedAt" timestamptz;

CREATE TABLE IF NOT EXISTS public."email_verification_token" (
  "id" bigserial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES public."app_user"("userId") ON DELETE CASCADE,
  "tokenHash" varchar(64) NOT NULL UNIQUE CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  "expiresAt" timestamptz NOT NULL,
  "isUsed" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "usedAt" timestamptz,
  CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX IF NOT EXISTS idx_email_verify_user_state_expiry
  ON public."email_verification_token" ("userId", "isUsed", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_token_hash_unique
  ON public."password_reset_token" ("tokenHash");
CREATE INDEX IF NOT EXISTS idx_reset_token_user_state_expiry
  ON public."password_reset_token" ("userId", "isUsed", "expiresAt");

-- Do not allow public Supabase data APIs to read password hashes or recovery tokens.
ALTER TABLE public."app_user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."password_reset_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."email_verification_token" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."email_verification_token" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public."email_verification_token_id_seq" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."email_verification_token" TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public."email_verification_token_id_seq" TO service_role;

-- SECURITY DEFINER functions are service-role only. Only the digest, never the
-- raw token, is sent to PostgreSQL. UPDATE and token consumption are atomic.
CREATE OR REPLACE FUNCTION public.redeem_erp_email_verification(p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id bigint; v_user integer;
BEGIN
  SELECT "id", "userId" INTO v_id, v_user
    FROM public."email_verification_token"
    WHERE "tokenHash" = p_hash AND "isUsed" = false AND "expiresAt" > now()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public."app_user" SET "emailVerifiedAt" = now()
    WHERE "userId" = v_user AND "status" = 'Active' AND "isBlocked" = false;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public."email_verification_token" SET "isUsed" = true, "usedAt" = now()
    WHERE "id" = v_id;
  UPDATE public."email_verification_token" SET "isUsed" = true, "usedAt" = now()
    WHERE "userId" = v_user AND "isUsed" = false;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_erp_password_reset(p_hash text, p_password_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id bigint; v_user integer;
BEGIN
  IF p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
    RAISE EXCEPTION 'A bcrypt password hash is required';
  END IF;
  SELECT "id", "userId" INTO v_id, v_user
    FROM public."password_reset_token"
    WHERE "tokenHash" = p_hash AND "isUsed" = false AND "expiresAt" > now()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public."app_user"
    SET "passwordHash" = p_password_hash,
        "sessionRevokedAt" = now(),
        "stamp" = LEFT('EDITED password-reset ' || now()::text, 80)
    WHERE "userId" = v_user AND "status" = 'Active' AND "isBlocked" = false;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public."password_reset_token" SET "isUsed" = true, "usedAt" = now()
    WHERE "userId" = v_user AND "isUsed" = false;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.redeem_erp_email_verification(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_erp_password_reset(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_erp_email_verification(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_erp_password_reset(text, text) TO service_role;
COMMIT;
