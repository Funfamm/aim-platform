-- Sync migration: captures all changes applied via `prisma db push` after the last
-- tracked migration (20260408120000_add_scheduled_audit_at).
--
-- On the EXISTING production database these columns/tables already exist, so this
-- migration is marked as "already applied" via `prisma migrate resolve`.
-- On a FRESH database, `prisma migrate deploy` will run this SQL to create them.

-- ═══════════════════════════════════════════════════════════════════
-- New tables created via db push
-- ═══════════════════════════════════════════════════════════════════

-- AdminAuditLog
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actor_idx" ON "AdminAuditLog"("actor");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AudioTrack
CREATE TABLE IF NOT EXISTS "AudioTrack" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "label" TEXT,
    "url" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AudioTrack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AudioTrack_projectId_episodeId_language_key" ON "AudioTrack"("projectId", "episodeId", "language");
CREATE INDEX IF NOT EXISTS "AudioTrack_projectId_idx" ON "AudioTrack"("projectId");
ALTER TABLE "AudioTrack" DROP CONSTRAINT IF EXISTS "AudioTrack_projectId_fkey";
ALTER TABLE "AudioTrack" ADD CONSTRAINT "AudioTrack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetEmail" TEXT,
    "targetUserId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_adminId_idx" ON "AuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetEmail_idx" ON "AuditLog"("targetEmail");

-- EmailAuditLog
CREATE TABLE IF NOT EXISTS "EmailAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "transport" "EmailTransport" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    CONSTRAINT "EmailAuditLog_pkey" PRIMARY KEY ("id")
);

-- EventInvite
CREATE TABLE IF NOT EXISTS "EventInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EventInvite_eventId_idx" ON "EventInvite"("eventId");
CREATE INDEX IF NOT EXISTS "EventInvite_recipientEmail_idx" ON "EventInvite"("recipientEmail");
CREATE INDEX IF NOT EXISTS "EventInvite_recipientUserId_idx" ON "EventInvite"("recipientUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventInvite_tokenHash_key" ON "EventInvite"("tokenHash");
ALTER TABLE "EventInvite" DROP CONSTRAINT IF EXISTS "EventInvite_eventId_fkey";
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FilmCast
CREATE TABLE IF NOT EXISTS "FilmCast" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FilmCast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FilmCast_projectId_idx" ON "FilmCast"("projectId");
ALTER TABLE "FilmCast" DROP CONSTRAINT IF EXISTS "FilmCast_projectId_fkey";
ALTER TABLE "FilmCast" ADD CONSTRAINT "FilmCast_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LiveEvent
CREATE TABLE IF NOT EXISTS "LiveEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "roomName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "eventType" TEXT NOT NULL DEFAULT 'screening',
    "hostUserId" TEXT NOT NULL,
    "projectId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "maxParticipants" INTEGER NOT NULL DEFAULT 100,
    "recordingUrl" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveEvent_roomName_key" ON "LiveEvent"("roomName");
CREATE INDEX IF NOT EXISTS "LiveEvent_status_idx" ON "LiveEvent"("status");
CREATE INDEX IF NOT EXISTS "LiveEvent_eventType_status_idx" ON "LiveEvent"("eventType", "status");
CREATE INDEX IF NOT EXISTS "LiveEvent_hostUserId_idx" ON "LiveEvent"("hostUserId");
CREATE INDEX IF NOT EXISTS "LiveEvent_projectId_idx" ON "LiveEvent"("projectId");
CREATE INDEX IF NOT EXISTS "LiveEvent_scheduledAt_idx" ON "LiveEvent"("scheduledAt");
ALTER TABLE "LiveEvent" DROP CONSTRAINT IF EXISTS "LiveEvent_projectId_fkey";
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LiveEventAnalyticEvent
CREATE TABLE IF NOT EXISTS "LiveEventAnalyticEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveEventAnalyticEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LiveEventAnalyticEvent_eventId_name_idx" ON "LiveEventAnalyticEvent"("eventId", "name");
CREATE INDEX IF NOT EXISTS "LiveEventAnalyticEvent_eventId_createdAt_idx" ON "LiveEventAnalyticEvent"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveEventAnalyticEvent_userId_idx" ON "LiveEventAnalyticEvent"("userId");
ALTER TABLE "LiveEventAnalyticEvent" DROP CONSTRAINT IF EXISTS "LiveEventAnalyticEvent_eventId_fkey";
ALTER TABLE "LiveEventAnalyticEvent" ADD CONSTRAINT "LiveEventAnalyticEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MovieRoll
CREATE TABLE IF NOT EXISTS "MovieRoll" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "displayOn" TEXT NOT NULL DEFAULT 'home',
    "translations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MovieRoll_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MovieRoll_slug_key" ON "MovieRoll"("slug");
CREATE INDEX IF NOT EXISTS "MovieRoll_visible_sortOrder_idx" ON "MovieRoll"("visible", "sortOrder");
CREATE INDEX IF NOT EXISTS "MovieRoll_displayOn_idx" ON "MovieRoll"("displayOn");

-- MovieRollProject
CREATE TABLE IF NOT EXISTS "MovieRollProject" (
    "id" TEXT NOT NULL,
    "rollId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MovieRollProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MovieRollProject_rollId_projectId_key" ON "MovieRollProject"("rollId", "projectId");
CREATE INDEX IF NOT EXISTS "MovieRollProject_rollId_sortOrder_idx" ON "MovieRollProject"("rollId", "sortOrder");
ALTER TABLE "MovieRollProject" DROP CONSTRAINT IF EXISTS "MovieRollProject_rollId_fkey";
ALTER TABLE "MovieRollProject" ADD CONSTRAINT "MovieRollProject_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "MovieRoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProjectRequest
CREATE TABLE IF NOT EXISTS "ProjectRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "projectType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "genre" TEXT,
    "budget" TEXT,
    "timeline" TEXT,
    "references" TEXT,
    "attachments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNotes" TEXT,
    "accessToken" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectRequest_accessToken_key" ON "ProjectRequest"("accessToken");
CREATE INDEX IF NOT EXISTS "ProjectRequest_email_idx" ON "ProjectRequest"("email");
CREATE INDEX IF NOT EXISTS "ProjectRequest_projectType_idx" ON "ProjectRequest"("projectType");
CREATE INDEX IF NOT EXISTS "ProjectRequest_status_idx" ON "ProjectRequest"("status");
CREATE INDEX IF NOT EXISTS "ProjectRequest_createdAt_idx" ON "ProjectRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "ProjectRequest_urgent_status_idx" ON "ProjectRequest"("urgent", "status");

-- ProjectView
CREATE TABLE IF NOT EXISTS "ProjectView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectView_projectId_idx" ON "ProjectView"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectView_userId_idx" ON "ProjectView"("userId");
CREATE INDEX IF NOT EXISTS "ProjectView_createdAt_idx" ON "ProjectView"("createdAt");
CREATE INDEX IF NOT EXISTS "ProjectView_projectId_createdAt_idx" ON "ProjectView"("projectId", "createdAt");
ALTER TABLE "ProjectView" DROP CONSTRAINT IF EXISTS "ProjectView_projectId_fkey";
ALTER TABLE "ProjectView" ADD CONSTRAINT "ProjectView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ScriptCallNotify
CREATE TABLE IF NOT EXISTS "ScriptCallNotify" (
    "id" TEXT NOT NULL,
    "scriptCallId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScriptCallNotify_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScriptCallNotify_scriptCallId_userId_key" ON "ScriptCallNotify"("scriptCallId", "userId");
CREATE INDEX IF NOT EXISTS "ScriptCallNotify_userId_idx" ON "ScriptCallNotify"("userId");
ALTER TABLE "ScriptCallNotify" DROP CONSTRAINT IF EXISTS "ScriptCallNotify_scriptCallId_fkey";
ALTER TABLE "ScriptCallNotify" ADD CONSTRAINT "ScriptCallNotify_scriptCallId_fkey" FOREIGN KEY ("scriptCallId") REFERENCES "ScriptCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptCallNotify" DROP CONSTRAINT IF EXISTS "ScriptCallNotify_userId_fkey";
ALTER TABLE "ScriptCallNotify" ADD CONSTRAINT "ScriptCallNotify_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SubtitleHistoryClear
CREATE TABLE IF NOT EXISTS "SubtitleHistoryClear" (
    "id" TEXT NOT NULL,
    "subtitleId" TEXT NOT NULL,
    "clearedBy" TEXT NOT NULL,
    "clearedByEmail" TEXT NOT NULL DEFAULT '',
    "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearActionType" TEXT NOT NULL,
    "reason" TEXT,
    "rowsDeleted" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SubtitleHistoryClear_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SubtitleHistoryClear_subtitleId_clearedAt_idx" ON "SubtitleHistoryClear"("subtitleId", "clearedAt");
ALTER TABLE "SubtitleHistoryClear" DROP CONSTRAINT IF EXISTS "SubtitleHistoryClear_subtitleId_fkey";
ALTER TABLE "SubtitleHistoryClear" ADD CONSTRAINT "SubtitleHistoryClear_subtitleId_fkey" FOREIGN KEY ("subtitleId") REFERENCES "FilmSubtitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SubtitleJob
CREATE TABLE IF NOT EXISTS "SubtitleJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "callbackUrl" TEXT,
    "workerUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubtitleJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SubtitleJob_projectId_idx" ON "SubtitleJob"("projectId");
CREATE INDEX IF NOT EXISTS "SubtitleJob_status_createdAt_idx" ON "SubtitleJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SubtitleJob_projectId_episodeId_status_idx" ON "SubtitleJob"("projectId", "episodeId", "status");

-- SubtitleRevision indexes & FK
CREATE INDEX IF NOT EXISTS "SubtitleRevision_subtitleId_savedAt_idx" ON "SubtitleRevision"("subtitleId", "savedAt");
ALTER TABLE "SubtitleRevision" DROP CONSTRAINT IF EXISTS "SubtitleRevision_subtitleId_fkey";
ALTER TABLE "SubtitleRevision" ADD CONSTRAINT "SubtitleRevision_subtitleId_fkey" FOREIGN KEY ("subtitleId") REFERENCES "FilmSubtitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WatchPartyMessage
CREATE TABLE IF NOT EXISTS "WatchPartyMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchPartyMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WatchPartyMessage_eventId_createdAt_idx" ON "WatchPartyMessage"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "WatchPartyMessage_eventId_hidden_idx" ON "WatchPartyMessage"("eventId", "hidden");
ALTER TABLE "WatchPartyMessage" DROP CONSTRAINT IF EXISTS "WatchPartyMessage_eventId_fkey";
ALTER TABLE "WatchPartyMessage" ADD CONSTRAINT "WatchPartyMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WatchPartyReaction
CREATE TABLE IF NOT EXISTS "WatchPartyReaction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchPartyReaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WatchPartyReaction_eventId_createdAt_idx" ON "WatchPartyReaction"("eventId", "createdAt");
ALTER TABLE "WatchPartyReaction" DROP CONSTRAINT IF EXISTS "WatchPartyReaction_eventId_fkey";
ALTER TABLE "WatchPartyReaction" ADD CONSTRAINT "WatchPartyReaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- Column additions to existing tables (via db push)
-- ═══════════════════════════════════════════════════════════════════

-- Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "adminRevealOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiScoredAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "auditState" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "lastProcessingError" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "notifyAfter" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "pendingNotifyStatus" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "processingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Application_auditState_idx" ON "Application"("auditState");
CREATE INDEX IF NOT EXISTS "Application_priority_queuedAt_idx" ON "Application"("priority", "queuedAt");

-- ApplicationNotification
ALTER TABLE "ApplicationNotification" ADD COLUMN IF NOT EXISTS "notifiedForStatus" TEXT;
CREATE INDEX IF NOT EXISTS "ApplicationNotification_applicationId_notifiedForStatus_status_idx" ON "ApplicationNotification"("applicationId", "notifiedForStatus", "status");

-- CastingCall
ALTER TABLE "CastingCall" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
ALTER TABLE "CastingCall" ADD COLUMN IF NOT EXISTS "genre" TEXT;
CREATE INDEX IF NOT EXISTS "CastingCall_genre_idx" ON "CastingCall"("genre");

-- EmailLog indexes
CREATE INDEX IF NOT EXISTS "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");
CREATE INDEX IF NOT EXISTS "EmailLog_success_idx" ON "EmailLog"("success");
CREATE INDEX IF NOT EXISTS "EmailLog_trackingId_idx" ON "EmailLog"("trackingId");
CREATE INDEX IF NOT EXISTS "EmailLog_type_idx" ON "EmailLog"("type");

-- FilmSubtitle — subtitle placement + mobile + landscape fields
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "verticalAnchor" TEXT NOT NULL DEFAULT 'bottom';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "horizontalAlign" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "offsetYPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "offsetXPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "safeAreaMarginPx" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "backgroundStyle" TEXT NOT NULL DEFAULT 'shadow';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "cueOverrides" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "useSeparateMobilePlacement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "mobileVerticalAnchor" TEXT NOT NULL DEFAULT 'bottom';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "mobileHorizontalAlign" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "mobileOffsetYPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "mobileOffsetXPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "mobileSafeAreaMarginPx" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "mobileFontScale" DOUBLE PRECISION NOT NULL DEFAULT 0.9;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "landscapeVerticalAnchor" TEXT NOT NULL DEFAULT 'bottom';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "landscapeHorizontalAlign" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "landscapeOffsetYPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "landscapeOffsetXPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "landscapeSafeAreaMarginPx" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "landscapeFontScale" DOUBLE PRECISION NOT NULL DEFAULT 0.9;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "originalLanguage" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "translateStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "langStatus" JSONB;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "vttPaths" JSONB;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "qcIssues" TEXT;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "generatedWith" TEXT;
ALTER TABLE "FilmSubtitle" ADD COLUMN IF NOT EXISTS "transcribedWith" TEXT;

-- PageMedia
ALTER TABLE "PageMedia" ADD COLUMN IF NOT EXISTS "target" TEXT NOT NULL DEFAULT 'all';

-- Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "publishNotifyGroups" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "sponsorData" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Project_createdAt_idx" ON "Project"("createdAt");
CREATE INDEX IF NOT EXISTS "Project_featured_sortOrder_idx" ON "Project"("featured", "sortOrder");
CREATE INDEX IF NOT EXISTS "Project_genre_viewCount_idx" ON "Project"("genre", "viewCount");
CREATE INDEX IF NOT EXISTS "Project_viewCount_idx" ON "Project"("viewCount");

-- ScriptCall
ALTER TABLE "ScriptCall" ADD COLUMN IF NOT EXISTS "contentTranslations" TEXT;

-- ScriptSubmission
ALTER TABLE "ScriptSubmission" ADD COLUMN IF NOT EXISTS "lastNotifiedStatus" TEXT;

-- SiteSettings
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "auditQueueBatchSize" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SiteSettings" ALTER COLUMN "notifyOnContentPublish" SET DEFAULT true;

-- Sponsor
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "descriptionI18n" JSONB;

-- Subscriber
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "confirmToken" TEXT;
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Subscriber" ALTER COLUMN "active" SET DEFAULT false;

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mediaProfile" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "receiveLocalizedEmails" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "themeMode" TEXT;

-- UserNotification
ALTER TABLE "UserNotification" DROP CONSTRAINT IF EXISTS "UserNotification_eventId_key";
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserNotification_eventId_key') THEN
    ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_eventId_key" UNIQUE ("eventId");
  END IF;
END $$;

-- UserNotificationPreference
ALTER TABLE "UserNotificationPreference" ALTER COLUMN "contentPublish" SET DEFAULT true;

-- WatchHistory
ALTER TABLE "WatchHistory" ADD COLUMN IF NOT EXISTS "subtitleLang" TEXT;
ALTER TABLE "WatchHistory" ADD COLUMN IF NOT EXISTS "audioLang" TEXT;
ALTER TABLE "WatchHistory" ADD COLUMN IF NOT EXISTS "captionsOn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WatchHistory" ADD COLUMN IF NOT EXISTS "completePct" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "WatchHistory_userId_projectId_idx" ON "WatchHistory"("userId", "projectId");
