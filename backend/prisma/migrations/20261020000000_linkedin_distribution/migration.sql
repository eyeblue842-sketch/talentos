-- LinkedIn distribution: recruiter opt-in, platform-owned destinations,
-- durable per-(job, destination) posts, and first-party attribution.
ALTER TYPE "BackgroundTaskType" ADD VALUE IF NOT EXISTS 'LINKEDIN_POST';

CREATE TYPE "LinkedInDestinationType" AS ENUM ('RECRUITER', 'PLATFORM');
CREATE TYPE "LinkedInPostStatus" AS ENUM ('QUEUED', 'PUBLISHING', 'RETRYING', 'PUBLISHED', 'FAILED', 'NEEDS_ACTION', 'CANCELLED');
CREATE TYPE "LinkedInTrackingEventType" AS ENUM ('CLICK', 'REGISTRATION_START', 'REGISTRATION_COMPLETE', 'RESUME_UPLOAD', 'PROFILE_COMPLETE', 'APPLICATION');

ALTER TABLE "Job" ADD COLUMN "shareOnLinkedIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN "excludeFromPlatformLinkedIn" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "LinkedInDestination" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "setupEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_AUTH',
    "memberUrn" TEXT,
    "memberName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastErrorCategory" TEXT,
    "lastErrorMessage" TEXT,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedInDestination_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LinkedInDestination_memberUrn_key" ON "LinkedInDestination"("memberUrn");
CREATE INDEX "LinkedInDestination_status_enabled_idx" ON "LinkedInDestination"("status", "enabled");
-- At most one primary destination.
CREATE UNIQUE INDEX "LinkedInDestination_single_primary" ON "LinkedInDestination"("isPrimary") WHERE "isPrimary" = true;

CREATE TABLE "LinkedInPlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoDistribute" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedInPlatformSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkedInPost" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "organisationId" TEXT,
    "destinationType" "LinkedInDestinationType" NOT NULL,
    "destinationId" TEXT NOT NULL,
    "authorUrn" TEXT,
    "status" "LinkedInPostStatus" NOT NULL DEFAULT 'QUEUED',
    "commentary" TEXT NOT NULL,
    "trackingRef" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCategory" TEXT,
    "lastErrorMessage" TEXT,
    "linkedinPostId" TEXT,
    "postUrl" TEXT,
    "backgroundTaskId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "requestedByUserId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedInPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LinkedInPost_trackingRef_key" ON "LinkedInPost"("trackingRef");
CREATE UNIQUE INDEX "LinkedInPost_jobId_destinationType_destinationId_key" ON "LinkedInPost"("jobId", "destinationType", "destinationId");
CREATE INDEX "LinkedInPost_status_nextAttemptAt_idx" ON "LinkedInPost"("status", "nextAttemptAt");
CREATE INDEX "LinkedInPost_destinationType_destinationId_status_idx" ON "LinkedInPost"("destinationType", "destinationId", "status");
CREATE INDEX "LinkedInPost_organisationId_idx" ON "LinkedInPost"("organisationId");
ALTER TABLE "LinkedInPost" ADD CONSTRAINT "LinkedInPost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LinkedInTrackingEvent" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" "LinkedInTrackingEventType" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkedInTrackingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LinkedInTrackingEvent_postId_eventType_subjectKey_key" ON "LinkedInTrackingEvent"("postId", "eventType", "subjectKey");
CREATE INDEX "LinkedInTrackingEvent_postId_eventType_idx" ON "LinkedInTrackingEvent"("postId", "eventType");
CREATE INDEX "LinkedInTrackingEvent_jobId_eventType_idx" ON "LinkedInTrackingEvent"("jobId", "eventType");
ALTER TABLE "LinkedInTrackingEvent" ADD CONSTRAINT "LinkedInTrackingEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "LinkedInPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
