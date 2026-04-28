-- AlterTable: add logRetentionDays to SiteSettings
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "logRetentionDays" INTEGER NOT NULL DEFAULT 90;
