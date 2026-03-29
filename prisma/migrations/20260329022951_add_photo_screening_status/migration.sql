/*
  Warnings:

  - The `status` column on the `Application` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('submitted', 'under_review', 'reviewed', 'shortlisted', 'contacted', 'audition', 'callback', 'final_review', 'selected', 'not_selected', 'rejected', 'withdrawn', 'pending', 'approved');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "photoScreeningStatus" TEXT,
ADD COLUMN     "statusNoteTranslations" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted';

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");
