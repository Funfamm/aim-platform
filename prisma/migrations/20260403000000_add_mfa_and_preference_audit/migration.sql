-- Migration: add_mfa_and_preference_audit
-- Adds MFA (Email OTP) fields to User and PreferenceAudit compliance table.
-- Applied via: npx prisma migrate deploy

-- MFA fields on User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaEnabled"   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "mfaTempCode"  TEXT,
  ADD COLUMN IF NOT EXISTS "mfaExpiresAt" TIMESTAMP(3);

-- Compliance audit table for notification preference changes
CREATE TABLE IF NOT EXISTS "PreferenceAudit" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "changedFields" JSONB NOT NULL,
  "timestamp"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreferenceAudit_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "PreferenceAudit_userId_idx"    ON "PreferenceAudit"("userId");
CREATE INDEX IF NOT EXISTS "PreferenceAudit_timestamp_idx" ON "PreferenceAudit"("timestamp");
