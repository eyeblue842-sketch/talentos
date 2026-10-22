-- The IntelligenceFeature enum value INTERVIEW_ASSISTANT and the AI screening-call tables existed in schema.prisma
-- but never had a migration, so databases built from migrations failed with: invalid input value for enum
-- "IntelligenceFeature": "INTERVIEW_ASSISTANT" (interview assistant on the application page).

-- CreateEnum
CREATE TYPE "ScreeningCallProvider" AS ENUM ('PLIVO', 'VAPI');

-- CreateEnum
CREATE TYPE "ScreeningCallStatus" AS ENUM ('PENDING', 'DRY_RUN', 'QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScreeningCallOutcome" AS ENUM ('PENDING', 'INTERESTED', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'DO_NOT_CONTACT', 'UNREACHABLE', 'INCOMPLETE');

ALTER TYPE "IntelligenceFeature" ADD VALUE IF NOT EXISTS 'INTERVIEW_ASSISTANT';

-- CreateTable
CREATE TABLE "ScreeningCall" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "initiatedByUserId" TEXT,
    "provider" "ScreeningCallProvider" NOT NULL,
    "providerCallId" TEXT,
    "status" "ScreeningCallStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "ScreeningCallOutcome" NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "toPhoneNumber" TEXT NOT NULL,
    "callerId" TEXT,
    "consentCaptured" BOOLEAN NOT NULL DEFAULT false,
    "consentSource" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "endedReason" TEXT,
    "recordingUrl" TEXT,
    "transcript" TEXT,
    "promptVariables" JSONB,
    "currentCtc" TEXT,
    "expectedCtc" TEXT,
    "noticePeriod" TEXT,
    "noticeNegotiable" BOOLEAN,
    "buyoutAvailable" BOOLEAN,
    "earliestJoinDate" TEXT,
    "techAnswers" JSONB,
    "interestSummary" TEXT,
    "aiSummary" TEXT,
    "lastProviderEvent" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningCall_providerCallId_key" ON "ScreeningCall"("providerCallId");

-- CreateIndex
CREATE INDEX "ScreeningCall_organisationId_createdAt_idx" ON "ScreeningCall"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "ScreeningCall_applicationId_idx" ON "ScreeningCall"("applicationId");

-- CreateIndex
CREATE INDEX "ScreeningCall_status_idx" ON "ScreeningCall"("status");

-- AddForeignKey
ALTER TABLE "ScreeningCall" ADD CONSTRAINT "ScreeningCall_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
