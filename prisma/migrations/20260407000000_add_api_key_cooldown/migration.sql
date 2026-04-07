-- AlterTable: Add cooledDownUntil column to ApiKey for 429 rate-limit cooldown tracking
ALTER TABLE "ApiKey" ADD COLUMN "cooledDownUntil" TIMESTAMP(3);
