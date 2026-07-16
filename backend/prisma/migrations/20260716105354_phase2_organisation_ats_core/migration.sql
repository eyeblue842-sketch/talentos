-- CreateEnum
CREATE TYPE "OrganisationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrganisationRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RequisitionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('SCREENING', 'TECHNICAL', 'MANAGERIAL', 'HR', 'PANEL', 'TAKE_HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULE_REQUIRED');

-- CreateEnum
CREATE TYPE "FeedbackRecommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE', 'STRONG_NO_HIRE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORGANISATION', 'MEMBERSHIP', 'REQUISITION', 'JOB', 'APPLICATION', 'INTERVIEW', 'FEEDBACK', 'SYSTEM');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "organisationId" TEXT;

-- AlterTable
ALTER TABLE "ApplicationActivity" ADD COLUMN     "organisationId" TEXT;

-- AlterTable
ALTER TABLE "AtsNote" ADD COLUMN     "organisationId" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "organisationId" TEXT,
ADD COLUMN     "requisitionId" TEXT;

-- AlterTable
ALTER TABLE "RecruiterProfile" ADD COLUMN     "organisationId" TEXT;

-- AlterTable
ALTER TABLE "SavedCandidate" ADD COLUMN     "organisationId" TEXT;

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganisationStatus" NOT NULL DEFAULT 'ACTIVE',
    "website" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationMembership" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganisationRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequisition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "requisitionCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "businessUnit" TEXT,
    "location" TEXT,
    "employmentType" "EmploymentType",
    "numberOfOpenings" INTEGER NOT NULL DEFAULT 1,
    "hiringManagerId" TEXT,
    "recruiterId" TEXT,
    "priority" "RequisitionPriority" NOT NULL DEFAULT 'MEDIUM',
    "targetHireDate" TIMESTAMP(3),
    "status" "RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "reasonForHiring" TEXT,
    "replacementFor" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "currency" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewProcess" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "interviewProcessId" TEXT NOT NULL,
    "roundName" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "interviewType" "InterviewType" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "scorecardCriteria" JSONB,
    "feedbackLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPanelMember" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "interviewRoundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewPanelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "interviewRoundId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "recommendation" "FeedbackRecommendation",
    "overallScore" INTEGER,
    "comments" TEXT,
    "criteriaScores" JSONB,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE INDEX "Organisation_status_idx" ON "Organisation"("status");

-- CreateIndex
CREATE INDEX "OrganisationMembership_userId_status_idx" ON "OrganisationMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "OrganisationMembership_organisationId_role_status_idx" ON "OrganisationMembership"("organisationId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMembership_organisationId_userId_key" ON "OrganisationMembership"("organisationId", "userId");

-- CreateIndex
CREATE INDEX "JobRequisition_organisationId_status_priority_idx" ON "JobRequisition"("organisationId", "status", "priority");

-- CreateIndex
CREATE INDEX "JobRequisition_organisationId_approvalStatus_idx" ON "JobRequisition"("organisationId", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "JobRequisition_organisationId_requisitionCode_key" ON "JobRequisition"("organisationId", "requisitionCode");

-- CreateIndex
CREATE INDEX "InterviewProcess_organisationId_applicationId_idx" ON "InterviewProcess"("organisationId", "applicationId");

-- CreateIndex
CREATE INDEX "InterviewRound_organisationId_status_idx" ON "InterviewRound"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRound_interviewProcessId_sequence_key" ON "InterviewRound"("interviewProcessId", "sequence");

-- CreateIndex
CREATE INDEX "InterviewPanelMember_organisationId_userId_idx" ON "InterviewPanelMember"("organisationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelMember_interviewRoundId_userId_key" ON "InterviewPanelMember"("interviewRoundId", "userId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_organisationId_interviewerId_submittedAt_idx" ON "InterviewFeedback"("organisationId", "interviewerId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewFeedback_interviewRoundId_interviewerId_key" ON "InterviewFeedback"("interviewRoundId", "interviewerId");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organisationId_recipientUserId_idx" ON "Notification"("organisationId", "recipientUserId");

-- CreateIndex
CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Application_organisationId_updatedAt_idx" ON "Application"("organisationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Application_organisationId_currentStage_idx" ON "Application"("organisationId", "currentStage");

-- CreateIndex
CREATE INDEX "ApplicationActivity_organisationId_applicationId_createdAt_idx" ON "ApplicationActivity"("organisationId", "applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AtsNote_organisationId_applicationId_idx" ON "AtsNote"("organisationId", "applicationId");

-- CreateIndex
CREATE INDEX "Job_organisationId_createdAt_idx" ON "Job"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_organisationId_status_idx" ON "Job"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Job_recruiterId_idx" ON "Job"("recruiterId");

-- CreateIndex
CREATE INDEX "Job_requisitionId_idx" ON "Job"("requisitionId");

-- CreateIndex
CREATE INDEX "RecruiterProfile_organisationId_idx" ON "RecruiterProfile"("organisationId");

-- CreateIndex
CREATE INDEX "SavedCandidate_organisationId_candidateId_idx" ON "SavedCandidate"("organisationId", "candidateId");

-- AddForeignKey
ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "JobRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtsNote" ADD CONSTRAINT "AtsNote_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationActivity" ADD CONSTRAINT "ApplicationActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCandidate" ADD CONSTRAINT "SavedCandidate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequisition" ADD CONSTRAINT "JobRequisition_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewProcess" ADD CONSTRAINT "InterviewProcess_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewProcess" ADD CONSTRAINT "InterviewProcess_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewProcess" ADD CONSTRAINT "InterviewProcess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_interviewProcessId_fkey" FOREIGN KEY ("interviewProcessId") REFERENCES "InterviewProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelMember" ADD CONSTRAINT "InterviewPanelMember_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelMember" ADD CONSTRAINT "InterviewPanelMember_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelMember" ADD CONSTRAINT "InterviewPanelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
