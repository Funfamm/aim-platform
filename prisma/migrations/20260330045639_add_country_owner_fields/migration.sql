-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "country" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
