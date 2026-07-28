-- CreateEnum
CREATE TYPE "JobDescriptionGenerationKind" AS ENUM ('FULL_DESCRIPTION');

-- CreateEnum
CREATE TYPE "JobDescriptionGenerationStatus" AS ENUM ('PENDING', 'READY', 'STALE', 'FAILED', 'DISABLED', 'REVIEW_REQUIRED');

-- AlterEnum
ALTER TYPE "BackgroundTaskType" ADD VALUE IF NOT EXISTS 'JOB_DESCRIPTION_GENERATION';

-- CreateTable
CREATE TABLE "JobDescriptionState" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "JobDescriptionGenerationKind" NOT NULL,
    "status" "JobDescriptionGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "latestExecutionId" TEXT,
    "latestResultId" TEXT,
    "sourceFingerprint" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "resultVersion" TEXT NOT NULL,
    "provider" "IntelligenceProvider",
    "providerVersion" TEXT,
    "model" TEXT,
    "modelVersion" TEXT,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DECIMAL(12,6),
    "generatedAt" TIMESTAMP(3),
    "staleReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDescriptionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobDescriptionState_organisationId_jobId_kind_key" ON "JobDescriptionState"("organisationId", "jobId", "kind");

-- CreateIndex
CREATE INDEX "JobDescriptionState_organisationId_status_updatedAt_idx" ON "JobDescriptionState"("organisationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "JobDescriptionState_jobId_kind_idx" ON "JobDescriptionState"("jobId", "kind");

-- AddForeignKey
ALTER TABLE "JobDescriptionState" ADD CONSTRAINT "JobDescriptionState_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescriptionState" ADD CONSTRAINT "JobDescriptionState_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescriptionState" ADD CONSTRAINT "JobDescriptionState_latestExecutionId_fkey" FOREIGN KEY ("latestExecutionId") REFERENCES "IntelligenceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescriptionState" ADD CONSTRAINT "JobDescriptionState_latestResultId_fkey" FOREIGN KEY ("latestResultId") REFERENCES "IntelligenceResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
