-- Add admin-configurable result reveal delay to SiteSettings
-- Default is 6 hours (applicants see AI audition results after this delay)

ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "resultRevealDelayHours" INTEGER NOT NULL DEFAULT 6;
