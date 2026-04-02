-- Add missing columns to Application table
-- These were added via prisma db push without proper migrations

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "statusNoteTranslations" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "photoScreeningStatus" TEXT;

-- Add missing columns to Project table (country, ownerId added later)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- Add missing Project foreign key (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_ownerId_fkey'
  ) THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add missing SiteSettings columns
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "emailTransport" TEXT NOT NULL DEFAULT 'graph';
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "emailReplyTo" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "searchBetaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Ensure emailTransport column has the right constraint (converting to enum-like TEXT is fine)
-- The Prisma EmailTransport enum is stored as TEXT in PostgreSQL with this setup.
