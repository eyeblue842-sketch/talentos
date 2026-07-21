-- CreateEnum
CREATE TYPE "IntelligenceProvider" AS ENUM (
  'DISABLED',
  'OPENAI',
  'ANTHROPIC',
  'GEMINI',
  'AZURE_OPENAI',
  'OLLAMA',
  'CUSTOM_OPENAI_COMPATIBLE'
);

-- CreateEnum
CREATE TYPE "IntelligenceFeature" AS ENUM (
  'RESUME_SUMMARY',
  'RESUME_SKILL_EXTRACTION',
  'CANDIDATE_MATCH',
  'JOB_DESCRIPTION',
  'INTERVIEW_ASSISTANCE',
  'TALENT_SEARCH',
  'ANALYTICS_INSIGHT',
  'OFFER_ASSISTANCE'
);

-- CreateEnum
CREATE TYPE "IntelligenceExecutionStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "BackgroundTaskType" AS ENUM (
  'INTERVIEW_REMINDER',
  'OFFER_EXPIRY',
  'OFFER_REMINDER',
  'EMAIL_RETRY',
  'RESUME_PARSE',
  'INTELLIGENCE_EXECUTION',
  'DATA_EXPORT',
  'STALE_RESULT_CLEANUP'
);

-- CreateEnum
CREATE TYPE "BackgroundTaskStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'RETRYING'
);

-- CreateTable
CREATE TABLE "IntelligenceExecution" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "feature" "IntelligenceFeature" NOT NULL,
  "promptKey" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "provider" "IntelligenceProvider" NOT NULL,
  "model" TEXT,
  "status" "IntelligenceExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "inputFingerprint" TEXT NOT NULL,
  "inputCharacterCount" INTEGER NOT NULL DEFAULT 0,
  "outputCharacterCount" INTEGER NOT NULL DEFAULT 0,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "estimatedCost" DECIMAL(12,6),
  "latencyMs" INTEGER,
  "errorCode" TEXT,
  "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
  "cacheHit" BOOLEAN NOT NULL DEFAULT false,
  "retries" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "IntelligenceExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceResult" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "resultVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "normalizedOutput" JSONB NOT NULL,
  "explanation" TEXT,
  "confidence" DECIMAL(5,2),
  "isMachineGenerated" BOOLEAN NOT NULL DEFAULT true,
  "dismissedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntelligenceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceFeedback" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER,
  "useful" BOOLEAN NOT NULL,
  "feedback" TEXT,
  "overrideReason" TEXT,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntelligenceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundTask" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT,
  "type" "BackgroundTaskType" NOT NULL,
  "status" "BackgroundTaskStatus" NOT NULL DEFAULT 'PENDING',
  "entityType" TEXT,
  "entityId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "BackgroundTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntelligenceExecution_organisationId_feature_createdAt_idx" ON "IntelligenceExecution"("organisationId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceExecution_organisationId_status_createdAt_idx" ON "IntelligenceExecution"("organisationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceExecution_requestedByUserId_createdAt_idx" ON "IntelligenceExecution"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceExecution_inputFingerprint_promptVersion_idx" ON "IntelligenceExecution"("inputFingerprint", "promptVersion");

-- CreateIndex
CREATE INDEX "IntelligenceResult_organisationId_entityType_entityId_createdAt_idx" ON "IntelligenceResult"("organisationId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceResult_organisationId_sourceFingerprint_resultVersion_idx" ON "IntelligenceResult"("organisationId", "sourceFingerprint", "resultVersion");

-- CreateIndex
CREATE INDEX "IntelligenceResult_expiresAt_idx" ON "IntelligenceResult"("expiresAt");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_executionId_createdAt_idx" ON "IntelligenceFeedback"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceFeedback_userId_createdAt_idx" ON "IntelligenceFeedback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundTask_idempotencyKey_key" ON "BackgroundTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BackgroundTask_organisationId_type_status_idx" ON "BackgroundTask"("organisationId", "type", "status");

-- CreateIndex
CREATE INDEX "BackgroundTask_status_nextAttemptAt_idx" ON "BackgroundTask"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BackgroundTask_entityType_entityId_idx" ON "BackgroundTask"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "IntelligenceExecution"
ADD CONSTRAINT "IntelligenceExecution_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceExecution"
ADD CONSTRAINT "IntelligenceExecution_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceResult"
ADD CONSTRAINT "IntelligenceResult_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceResult"
ADD CONSTRAINT "IntelligenceResult_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "IntelligenceExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceFeedback"
ADD CONSTRAINT "IntelligenceFeedback_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "IntelligenceExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceFeedback"
ADD CONSTRAINT "IntelligenceFeedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundTask"
ADD CONSTRAINT "BackgroundTask_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundTask"
ADD CONSTRAINT "BackgroundTask_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundTask"
ADD CONSTRAINT "BackgroundTask_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
