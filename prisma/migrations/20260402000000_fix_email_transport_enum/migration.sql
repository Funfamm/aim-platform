-- CreateEnum (idempotent: only if it doesn't exist yet)
DO $$ BEGIN
    CREATE TYPE "EmailTransport" AS ENUM ('graph', 'smtp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Convert the TEXT column to the enum type
-- First drop the default, alter type, then re-add default
ALTER TABLE "SiteSettings" ALTER COLUMN "emailTransport" DROP DEFAULT;
ALTER TABLE "SiteSettings" ALTER COLUMN "emailTransport" TYPE "EmailTransport" USING "emailTransport"::"EmailTransport";
ALTER TABLE "SiteSettings" ALTER COLUMN "emailTransport" SET DEFAULT 'graph';

-- Also add the duration column to Course if it doesn't exist
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "duration" TEXT;

-- Also fix the EmailLog transport column if it exists
DO $$ BEGIN
    ALTER TABLE "EmailLog" ALTER COLUMN "transport" DROP DEFAULT;
    ALTER TABLE "EmailLog" ALTER COLUMN "transport" TYPE "EmailTransport" USING "transport"::"EmailTransport";
    ALTER TABLE "EmailLog" ALTER COLUMN "transport" SET DEFAULT 'graph';
EXCEPTION
    WHEN undefined_table THEN null;
    WHEN undefined_column THEN null;
END $$;
