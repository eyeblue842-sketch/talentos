-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE IF NOT EXISTS 'MEETING_PROVIDER_STATE';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingProvider" AS ENUM ('GOOGLE_MEET', 'ZOOM', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'EXPIRED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "InterviewMeetingStatus" AS ENUM (
    'DRAFT',
    'SCHEDULING',
    'SCHEDULED',
    'RESCHEDULE_REQUESTED',
    'RESCHEDULING',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW',
    'PROVIDER_FAILED',
    'PARTIALLY_FAILED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingParticipantRole" AS ENUM (
    'CANDIDATE',
    'INTERVIEWER',
    'LEAD_INTERVIEWER',
    'HIRING_MANAGER',
    'RECRUITER',
    'COORDINATOR',
    'OBSERVER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingRsvpStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE', 'NOT_SENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingAttendanceStatus" AS ENUM ('UNKNOWN', 'ATTENDED', 'NO_SHOW', 'EXCUSED', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "InterviewRescheduleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "InterviewRescheduleRequesterType" AS ENUM ('CANDIDATE', 'INTERVIEWER', 'RECRUITER', 'COORDINATOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingReminderStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "OrganisationSettings"
ADD COLUMN IF NOT EXISTS "interviewSchedulingSettings" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingProviderConnection" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "provider" "MeetingProvider" NOT NULL,
  "status" "MeetingConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "connectedAccountId" TEXT,
  "connectedEmail" TEXT,
  "encryptedRefreshToken" TEXT,
  "encryptedAccessToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "scopes" JSONB,
  "calendarId" TEXT,
  "providerMetadata" JSONB,
  "lastValidatedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "connectedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InterviewMeeting" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "interviewRoundId" TEXT NOT NULL,
  "provider" "MeetingProvider",
  "mode" "MeetingMode" NOT NULL,
  "status" "InterviewMeetingStatus" NOT NULL DEFAULT 'DRAFT',
  "externalMeetingId" TEXT,
  "externalCalendarEventId" TEXT,
  "conferenceId" TEXT,
  "safeJoinUrl" TEXT,
  "encryptedHostUrl" TEXT,
  "passcodeMetadata" JSONB,
  "timezone" TEXT NOT NULL,
  "scheduledStartUtc" TIMESTAMP(3) NOT NULL,
  "scheduledEndUtc" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "location" TEXT,
  "officeAddress" TEXT,
  "dialInInformation" TEXT,
  "providerDisplayName" TEXT,
  "instructions" TEXT,
  "candidateInstructions" TEXT,
  "internalNotes" TEXT,
  "providerMetadata" JSONB,
  "providerOperationKey" TEXT,
  "operationVersion" INTEGER NOT NULL DEFAULT 1,
  "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
  "lastRescheduledAt" TIMESTAMP(3),
  "providerLastSyncedAt" TIMESTAMP(3),
  "providerFailureCode" TEXT,
  "providerFailureMessage" TEXT,
  "providerCancelledAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingParticipant" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT,
  "candidateId" TEXT,
  "email" TEXT NOT NULL,
  "participantRole" "MeetingParticipantRole" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "rsvpStatus" "MeetingRsvpStatus" NOT NULL DEFAULT 'PENDING',
  "attendanceStatus" "MeetingAttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InterviewRescheduleRequest" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "interviewMeetingId" TEXT NOT NULL,
  "requestedByType" "InterviewRescheduleRequesterType" NOT NULL,
  "requestedByUserId" TEXT,
  "candidateId" TEXT,
  "reasonCode" TEXT,
  "reasonText" TEXT,
  "preferredTimezone" TEXT,
  "status" "InterviewRescheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewRescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InterviewRescheduleOption" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "proposedStartUtc" TIMESTAMP(3) NOT NULL,
  "proposedEndUtc" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewRescheduleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InterviewScheduleHistory" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "interviewMeetingId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "oldStartUtc" TIMESTAMP(3),
  "oldEndUtc" TIMESTAMP(3),
  "newStartUtc" TIMESTAMP(3),
  "newEndUtc" TIMESTAMP(3),
  "oldProvider" "MeetingProvider",
  "newProvider" "MeetingProvider",
  "oldParticipantSnapshot" JSONB,
  "newParticipantSnapshot" JSONB,
  "reason" TEXT,
  "providerOperationId" TEXT,
  "providerResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewScheduleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingReminder" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "interviewMeetingId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "reminderType" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "MeetingReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
  "backgroundTaskId" TEXT,
  "sentAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingProviderConnection_organisationId_provider_key" ON "MeetingProviderConnection"("organisationId", "provider");
CREATE INDEX IF NOT EXISTS "MeetingProviderConnection_organisationId_status_idx" ON "MeetingProviderConnection"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InterviewMeeting_interviewRoundId_key" ON "InterviewMeeting"("interviewRoundId");
CREATE INDEX IF NOT EXISTS "InterviewMeeting_organisationId_status_scheduledStartUtc_idx" ON "InterviewMeeting"("organisationId", "status", "scheduledStartUtc");
CREATE INDEX IF NOT EXISTS "InterviewMeeting_organisationId_provider_status_idx" ON "InterviewMeeting"("organisationId", "provider", "status");
CREATE INDEX IF NOT EXISTS "InterviewMeeting_externalCalendarEventId_idx" ON "InterviewMeeting"("externalCalendarEventId");
CREATE INDEX IF NOT EXISTS "InterviewMeeting_externalMeetingId_idx" ON "InterviewMeeting"("externalMeetingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingParticipant_meetingId_email_key" ON "MeetingParticipant"("meetingId", "email");
CREATE INDEX IF NOT EXISTS "MeetingParticipant_organisationId_meetingId_participantRole_idx" ON "MeetingParticipant"("organisationId", "meetingId", "participantRole");
CREATE INDEX IF NOT EXISTS "MeetingParticipant_userId_attendanceStatus_idx" ON "MeetingParticipant"("userId", "attendanceStatus");
CREATE INDEX IF NOT EXISTS "MeetingParticipant_candidateId_attendanceStatus_idx" ON "MeetingParticipant"("candidateId", "attendanceStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InterviewRescheduleRequest_organisationId_status_createdAt_idx" ON "InterviewRescheduleRequest"("organisationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "InterviewRescheduleRequest_interviewMeetingId_status_idx" ON "InterviewRescheduleRequest"("interviewMeetingId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InterviewRescheduleOption_requestId_priority_idx" ON "InterviewRescheduleOption"("requestId", "priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InterviewScheduleHistory_organisationId_createdAt_idx" ON "InterviewScheduleHistory"("organisationId", "createdAt");
CREATE INDEX IF NOT EXISTS "InterviewScheduleHistory_interviewMeetingId_createdAt_idx" ON "InterviewScheduleHistory"("interviewMeetingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingReminder_backgroundTaskId_key" ON "MeetingReminder"("backgroundTaskId");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingReminder_participantId_reminderType_scheduledFor_key" ON "MeetingReminder"("participantId", "reminderType", "scheduledFor");
CREATE INDEX IF NOT EXISTS "MeetingReminder_organisationId_scheduledFor_status_idx" ON "MeetingReminder"("organisationId", "scheduledFor", "status");
CREATE INDEX IF NOT EXISTS "MeetingReminder_interviewMeetingId_status_idx" ON "MeetingReminder"("interviewMeetingId", "status");

-- AddForeignKey
ALTER TABLE "MeetingProviderConnection"
ADD CONSTRAINT "MeetingProviderConnection_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingProviderConnection"
ADD CONSTRAINT "MeetingProviderConnection_connectedByUserId_fkey"
FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewMeeting"
ADD CONSTRAINT "InterviewMeeting_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewMeeting"
ADD CONSTRAINT "InterviewMeeting_interviewRoundId_fkey"
FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewMeeting"
ADD CONSTRAINT "InterviewMeeting_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewMeeting"
ADD CONSTRAINT "InterviewMeeting_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingParticipant"
ADD CONSTRAINT "MeetingParticipant_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingParticipant"
ADD CONSTRAINT "MeetingParticipant_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "InterviewMeeting"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingParticipant"
ADD CONSTRAINT "MeetingParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingParticipant"
ADD CONSTRAINT "MeetingParticipant_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewRescheduleRequest"
ADD CONSTRAINT "InterviewRescheduleRequest_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewRescheduleRequest"
ADD CONSTRAINT "InterviewRescheduleRequest_interviewMeetingId_fkey"
FOREIGN KEY ("interviewMeetingId") REFERENCES "InterviewMeeting"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewRescheduleRequest"
ADD CONSTRAINT "InterviewRescheduleRequest_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewRescheduleRequest"
ADD CONSTRAINT "InterviewRescheduleRequest_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewRescheduleRequest"
ADD CONSTRAINT "InterviewRescheduleRequest_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewRescheduleOption"
ADD CONSTRAINT "InterviewRescheduleOption_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "InterviewRescheduleRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewScheduleHistory"
ADD CONSTRAINT "InterviewScheduleHistory_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewScheduleHistory"
ADD CONSTRAINT "InterviewScheduleHistory_interviewMeetingId_fkey"
FOREIGN KEY ("interviewMeetingId") REFERENCES "InterviewMeeting"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewScheduleHistory"
ADD CONSTRAINT "InterviewScheduleHistory_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingReminder"
ADD CONSTRAINT "MeetingReminder_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingReminder"
ADD CONSTRAINT "MeetingReminder_interviewMeetingId_fkey"
FOREIGN KEY ("interviewMeetingId") REFERENCES "InterviewMeeting"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingReminder"
ADD CONSTRAINT "MeetingReminder_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "MeetingParticipant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
