ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "pendingNotifyStatus" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "notifyAfter" TIMESTAMP(3);
