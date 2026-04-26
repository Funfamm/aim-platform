-- Add mediaType discriminator to FilmSubtitle for movie/trailer separation
ALTER TABLE "FilmSubtitle" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'movie';

-- Drop old unique constraint and create new one including mediaType
DROP INDEX IF EXISTS "FilmSubtitle_projectId_episodeId_key";
ALTER TABLE "FilmSubtitle" ADD CONSTRAINT "FilmSubtitle_projectId_episodeId_mediaType_key" UNIQUE ("projectId", "episodeId", "mediaType");
