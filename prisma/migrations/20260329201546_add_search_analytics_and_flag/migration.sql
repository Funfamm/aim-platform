-- AlterTable
ALTER TABLE "SiteSettings" ALTER COLUMN "searchBetaEnabled" SET DEFAULT false;

-- CreateTable
CREATE TABLE "SearchAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchAnalytics_pkey" PRIMARY KEY ("id")
);
