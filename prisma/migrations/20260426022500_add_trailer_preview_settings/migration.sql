-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "trailerPreviewEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteSettings" ADD COLUMN     "trailerPreviewSeconds" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "SiteSettings" ADD COLUMN     "trailerPreviewMessage" TEXT;
