-- Content Advisory + Player Timings
-- AddColumns: Project (5), Episode (4)
-- All additive. No drops. No renames. No type changes.

-- Project: Content Advisory
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contentRating" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contentDescriptors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Project: Player Timings
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "introStartSeconds" INTEGER;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "introEndSeconds" INTEGER;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "creditsStartSeconds" INTEGER;

-- Episode: Player Timings override
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "introStartSeconds" INTEGER;
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "introEndSeconds" INTEGER;
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "creditsStartSeconds" INTEGER;

-- Episode: Display order override (nullable)
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER;
