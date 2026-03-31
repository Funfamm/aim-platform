-- Add missing emailReplyTo column to SiteSettings
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "emailReplyTo" TEXT;
