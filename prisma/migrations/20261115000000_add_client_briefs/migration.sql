-- CreateTable
CREATE TABLE "ClientBrief" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "submittedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBriefConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "rates" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBriefConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBrief_token_key" ON "ClientBrief"("token");

-- CreateIndex
CREATE INDEX "ClientBrief_status_idx" ON "ClientBrief"("status");
