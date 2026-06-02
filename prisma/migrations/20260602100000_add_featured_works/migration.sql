-- Allow admin to feature a published project on the works page independently of the homepage
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "featuredWorks" BOOLEAN NOT NULL DEFAULT false;
