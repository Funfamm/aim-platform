-- Add eventId column to UserNotification for idempotent dedup
ALTER TABLE "UserNotification"
    ADD COLUMN IF NOT EXISTS "eventId" TEXT;

-- Unique constraint so duplicate events can't be inserted twice
CREATE UNIQUE INDEX IF NOT EXISTS "UserNotification_eventId_key"
    ON "UserNotification"("eventId")
    WHERE "eventId" IS NOT NULL;
