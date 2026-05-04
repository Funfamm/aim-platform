-- Add scheduledAt column to Announcement for future scheduled delivery
ALTER TABLE "Announcement" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- Composite index for the cron query: find scheduled rows due now
CREATE INDEX "Announcement_scheduledAt_status_idx" ON "Announcement"("scheduledAt", "status");
