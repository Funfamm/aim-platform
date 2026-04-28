-- Add mediaType column to FilmView for film vs trailer analytics separation
ALTER TABLE "FilmView" ADD COLUMN IF NOT EXISTS "mediaType" TEXT NOT NULL DEFAULT 'film';

-- Indexes for efficient trailer/film filtering
CREATE INDEX IF NOT EXISTS "FilmView_mediaType_idx" ON "FilmView"("mediaType");
CREATE INDEX IF NOT EXISTS "FilmView_mediaType_createdAt_idx" ON "FilmView"("mediaType", "createdAt");
