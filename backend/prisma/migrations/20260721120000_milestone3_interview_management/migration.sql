-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MeetingMode" AS ENUM ('VIRTUAL', 'ONSITE', 'HYBRID', 'PHONE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "InterviewDecision" AS ENUM ('MOVE_NEXT_ROUND', 'REJECT', 'HOLD', 'CANCEL', 'COMPLETE', 'READY_FOR_OFFER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'DIRECTOR';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'CLIENT';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'BEHAVIORAL';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- AlterTable
ALTER TABLE "InterviewRound"
ADD COLUMN "durationMinutes" INTEGER,
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "timezone" TEXT,
ADD COLUMN "meetingMode" "MeetingMode",
ADD COLUMN "officeAddress" TEXT,
ADD COLUMN "candidateInstructions" TEXT,
ADD COLUMN "instructions" TEXT,
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "decision" "InterviewDecision",
ADD COLUMN "decisionReason" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "calendarProvider" TEXT DEFAULT 'ICS',
ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRescheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InterviewPanelMember"
ADD COLUMN "isLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isObserver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "feedbackRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "InterviewFeedback"
ADD COLUMN "technicalRating" INTEGER,
ADD COLUMN "communicationRating" INTEGER,
ADD COLUMN "problemSolvingRating" INTEGER,
ADD COLUMN "cultureFitRating" INTEGER,
ADD COLUMN "strengths" TEXT,
ADD COLUMN "weaknesses" TEXT,
ADD COLUMN "detailedNotes" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InterviewRound_organisationId_ownerUserId_idx" ON "InterviewRound"("organisationId", "ownerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InterviewRound_organisationId_scheduledStartAt_idx" ON "InterviewRound"("organisationId", "scheduledStartAt");

-- AddForeignKey
ALTER TABLE "InterviewRound"
ADD CONSTRAINT "InterviewRound_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
