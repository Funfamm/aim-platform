-- Add missing phoneNumber column to UserNotificationPreference
-- This column was added to the Prisma schema but never migrated.
-- Without it, Prisma Client throws "column does not exist" on any query
-- against this table, causing GET /api/notifications/preferences to return 500.

ALTER TABLE "UserNotificationPreference"
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
