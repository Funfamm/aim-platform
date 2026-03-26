-- AlterTable
ALTER TABLE "User" ADD COLUMN "knownDevices" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "siteName" TEXT NOT NULL DEFAULT 'AIM Studio',
    "tagline" TEXT NOT NULL DEFAULT 'AI-Powered Filmmaking',
    "aboutText" TEXT NOT NULL DEFAULT '',
    "studioStory" TEXT NOT NULL DEFAULT '',
    "mission" TEXT NOT NULL DEFAULT '',
    "aboutPageData" TEXT,
    "logoUrl" TEXT,
    "socialLinks" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "geminiApiKey" TEXT,
    "aiModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "aiCustomPrompt" TEXT,
    "aiAutoAudit" BOOLEAN NOT NULL DEFAULT false,
    "autoShortlistThreshold" INTEGER NOT NULL DEFAULT 75,
    "autoRejectThreshold" INTEGER NOT NULL DEFAULT 25,
    "pipelineAutoAdvance" BOOLEAN NOT NULL DEFAULT true,
    "notifyApplicantOnStatusChange" BOOLEAN NOT NULL DEFAULT true,
    "defaultDeadlineDays" INTEGER NOT NULL DEFAULT 30,
    "castingAutoClose" BOOLEAN NOT NULL DEFAULT false,
    "requireVoice" BOOLEAN NOT NULL DEFAULT false,
    "maxPhotoUploads" INTEGER NOT NULL DEFAULT 6,
    "requireLoginForFilms" BOOLEAN NOT NULL DEFAULT true,
    "allowPublicTrailers" BOOLEAN NOT NULL DEFAULT true,
    "requireLoginForCasting" BOOLEAN NOT NULL DEFAULT false,
    "requireLoginForDonate" BOOLEAN NOT NULL DEFAULT false,
    "requireLoginForSponsors" BOOLEAN NOT NULL DEFAULT false,
    "allowPublicProjectPages" BOOLEAN NOT NULL DEFAULT true,
    "donationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "donationMinAmount" REAL NOT NULL DEFAULT 5.0,
    "notifyOnApplication" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDonation" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" TEXT,
    "notifyOnNewDevice" BOOLEAN NOT NULL DEFAULT true,
    "scriptCallsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "castingCallsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trainingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sponsorsPageEnabled" BOOLEAN NOT NULL DEFAULT true,
    "googleClientId" TEXT,
    "googleClientSecret" TEXT,
    "appleClientId" TEXT,
    "appleTeamId" TEXT,
    "appleKeyId" TEXT,
    "applePrivateKey" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFromName" TEXT,
    "smtpFromEmail" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "emailsEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_SiteSettings" ("aboutPageData", "aboutText", "address", "aiAutoAudit", "aiCustomPrompt", "aiModel", "allowPublicProjectPages", "allowPublicTrailers", "appleClientId", "appleKeyId", "applePrivateKey", "appleTeamId", "autoRejectThreshold", "autoShortlistThreshold", "castingAutoClose", "castingCallsEnabled", "contactEmail", "contactPhone", "defaultDeadlineDays", "donationMinAmount", "donationsEnabled", "emailsEnabled", "geminiApiKey", "googleClientId", "googleClientSecret", "id", "logoUrl", "maxPhotoUploads", "mission", "notifyApplicantOnStatusChange", "notifyEmail", "notifyOnApplication", "notifyOnDonation", "pipelineAutoAdvance", "requireLoginForCasting", "requireLoginForDonate", "requireLoginForFilms", "requireLoginForSponsors", "requireVoice", "scriptCallsEnabled", "siteName", "smtpFromEmail", "smtpFromName", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "socialLinks", "sponsorsPageEnabled", "studioStory", "tagline", "trainingEnabled") SELECT "aboutPageData", "aboutText", "address", "aiAutoAudit", "aiCustomPrompt", "aiModel", "allowPublicProjectPages", "allowPublicTrailers", "appleClientId", "appleKeyId", "applePrivateKey", "appleTeamId", "autoRejectThreshold", "autoShortlistThreshold", "castingAutoClose", "castingCallsEnabled", "contactEmail", "contactPhone", "defaultDeadlineDays", "donationMinAmount", "donationsEnabled", "emailsEnabled", "geminiApiKey", "googleClientId", "googleClientSecret", "id", "logoUrl", "maxPhotoUploads", "mission", "notifyApplicantOnStatusChange", "notifyEmail", "notifyOnApplication", "notifyOnDonation", "pipelineAutoAdvance", "requireLoginForCasting", "requireLoginForDonate", "requireLoginForFilms", "requireLoginForSponsors", "requireVoice", "scriptCallsEnabled", "siteName", "smtpFromEmail", "smtpFromName", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "socialLinks", "sponsorsPageEnabled", "studioStory", "tagline", "trainingEnabled" FROM "SiteSettings";
DROP TABLE "SiteSettings";
ALTER TABLE "new_SiteSettings" RENAME TO "SiteSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
