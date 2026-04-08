-- AlterTable: add scheduled audit timestamp to Application
ALTER TABLE "Application" ADD COLUMN "scheduledAuditAt" TIMESTAMP(3);

-- AlterTable: add configurable audit delay to SiteSettings
ALTER TABLE "SiteSettings" ADD COLUMN "auditDelayHours" INTEGER NOT NULL DEFAULT 2;

-- CreateIndex: fast lookup of applications due for cron audit
CREATE INDEX "Application_scheduledAuditAt_idx" ON "Application"("scheduledAuditAt");
