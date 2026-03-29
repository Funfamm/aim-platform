-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "searchBetaEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "CastingCall_roleName_roleDescription_idx" ON "CastingCall"("roleName", "roleDescription");

-- CreateIndex
CREATE INDEX "Project_title_tagline_idx" ON "Project"("title", "tagline");

-- CreateIndex
CREATE INDEX "ScriptCall_title_idx" ON "ScriptCall"("title");

-- CreateIndex
CREATE INDEX "Sponsor_name_idx" ON "Sponsor"("name");
