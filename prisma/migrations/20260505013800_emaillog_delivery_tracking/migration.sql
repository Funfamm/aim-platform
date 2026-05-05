-- Add deliveredAt and clickedAt tracking columns to EmailLog
-- Idempotent: safe to re-run
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "clickedAt"   TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "EmailLog_deliveredAt_idx" ON "EmailLog"("deliveredAt");
CREATE INDEX IF NOT EXISTS "EmailLog_clickedAt_idx"   ON "EmailLog"("clickedAt");
