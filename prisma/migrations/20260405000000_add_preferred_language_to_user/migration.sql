-- AlterTable: add preferredLanguage column to User (was missing from migration history)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'en';