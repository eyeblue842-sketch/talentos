ALTER TYPE "BackgroundTaskType" ADD VALUE 'CANDIDATE_MATCH_GENERATION';

CREATE TYPE "CandidateJobMatchStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'STALE', 'DISABLED', 'REVIEW_REQUIRED');

CREATE TABLE "CandidateJobMatchState" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "CandidateJobMatchStatus" NOT NULL DEFAULT 'PENDING',
    "latestExecutionId" TEXT,
    "latestResultId" TEXT,
    "candidateIntelligenceStateId" TEXT,
    "jobDescriptionStateId" TEXT,
    "latestResumeAssetId" TEXT,
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
    "lastGeneratedAt" TIMESTAMP(3),
    "lastSourceChangedAt" TIMESTAMP(3),
    "staleReason" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateJobMatchState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateJobMatchState_organisationId_candidateId_jobId_key" ON "CandidateJobMatchState"("organisationId", "candidateId", "jobId");
CREATE INDEX "CandidateJobMatchState_organisationId_status_updatedAt_idx" ON "CandidateJobMatchState"("organisationId", "status", "updatedAt");
CREATE INDEX "CandidateJobMatchState_jobId_status_updatedAt_idx" ON "CandidateJobMatchState"("jobId", "status", "updatedAt");
CREATE INDEX "CandidateJobMatchState_candidateId_status_updatedAt_idx" ON "CandidateJobMatchState"("candidateId", "status", "updatedAt");

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_latestExecutionId_fkey"
    FOREIGN KEY ("latestExecutionId") REFERENCES "IntelligenceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_latestResultId_fkey"
    FOREIGN KEY ("latestResultId") REFERENCES "IntelligenceResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_candidateIntelligenceStateId_fkey"
    FOREIGN KEY ("candidateIntelligenceStateId") REFERENCES "CandidateIntelligenceState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_jobDescriptionStateId_fkey"
    FOREIGN KEY ("jobDescriptionStateId") REFERENCES "JobDescriptionState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateJobMatchState"
    ADD CONSTRAINT "CandidateJobMatchState_latestResumeAssetId_fkey"
    FOREIGN KEY ("latestResumeAssetId") REFERENCES "ResumeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
