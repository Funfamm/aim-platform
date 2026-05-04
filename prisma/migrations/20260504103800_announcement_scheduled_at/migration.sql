-- Add scheduledAt column to Announcement for future scheduled delivery
-- IF NOT EXISTS guards make this safe to re-run if a previous attempt partially succeeded
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- Composite index for the cron query: find scheduled rows due now
CREATE INDEX IF NOT EXISTS "Announcement_scheduledAt_status_idx" ON "Announcement"("scheduledAt", "status");