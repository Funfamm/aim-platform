-- Migration: add DeletedSubscriberLog table
-- Created: 2026-05-05

CREATE TABLE "DeletedSubscriberLog" (
    "id"          TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "botScore"    INTEGER NOT NULL,
    "reason"      TEXT NOT NULL,
    "adminUserId" TEXT,
    "deletedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "DeletedSubscriberLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeletedSubscriberLog_deletedAt_idx" ON "DeletedSubscriberLog"("deletedAt");
CREATE INDEX "DeletedSubscriberLog_email_idx"     ON "DeletedSubscriberLog"("email");
