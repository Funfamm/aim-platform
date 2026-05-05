-- Add subscriberMode to SiteSettings: 'manual_approval' | 'double_opt_in'
-- Idempotent: safe to re-run
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "subscriberMode" TEXT NOT NULL DEFAULT 'manual_approval';
