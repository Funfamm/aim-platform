-- Phase 0: NotificationSignup — 10 additive fields for unified Notify Me tracking
--
-- All statements use ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Safe to run on production: userId and requestSource already exist as orphan
-- nullable TEXT columns (confirmed 2026-06-01) — those two statements are no-ops.
-- All remaining 8 columns are new and will be created.
--
-- No DROP, no TRUNCATE, no UPDATE, no destructive ALTER.
-- Existing rows: nullable columns fill with NULL; status fills with 'active'.
-- No existing data is modified or deleted.

-- ── Column additions ──────────────────────────────────────────────────────────

-- userId: no-op on production (orphan TEXT nullable column already exists)
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "userId"              TEXT;

ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "requestedBy"         TEXT;

-- requestSource: no-op on production (orphan TEXT nullable column already exists)
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "requestSource"       TEXT;

ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "sourceType"          TEXT;
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "sourceEntityId"      TEXT;
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "sourcePageUrl"       TEXT;

-- status: NOT NULL with default 'active' — existing rows receive 'active' automatically
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "status"              TEXT NOT NULL DEFAULT 'active';

ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "confirmationSentAt"  TIMESTAMP(3);
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "confirmationInAppAt" TIMESTAMP(3);
ALTER TABLE "NotificationSignup" ADD COLUMN IF NOT EXISTS "finalNoticeSentAt"   TIMESTAMP(3);

-- ── Index additions ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "NotificationSignup_userId_idx"
    ON "NotificationSignup"("userId");

CREATE INDEX IF NOT EXISTS "NotificationSignup_requestSource_idx"
    ON "NotificationSignup"("requestSource");

CREATE INDEX IF NOT EXISTS "NotificationSignup_sourceType_sourceEntityId_idx"
    ON "NotificationSignup"("sourceType", "sourceEntityId");

CREATE INDEX IF NOT EXISTS "NotificationSignup_status_idx"
    ON "NotificationSignup"("status");
