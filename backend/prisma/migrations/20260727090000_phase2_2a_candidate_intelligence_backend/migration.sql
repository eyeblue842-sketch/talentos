ALTER TYPE "IntelligenceProvider" ADD VALUE IF NOT EXISTS 'MOCK';
ALTER TYPE "IntelligenceProvider" ADD VALUE IF NOT EXISTS 'BEDROCK';
ALTER TYPE "IntelligenceFeature" ADD VALUE IF NOT EXISTS 'CANDIDATE_INTELLIGENCE';
ALTER TYPE "BackgroundTaskType" ADD VALUE IF NOT EXISTS 'CANDIDATE_INTELLIGENCE_GENERATION';

CREATE TYPE "CandidateIntelligenceKind" AS ENUM (
  'PROFILE_OVERVIEW',
  'JD_MATCH',
  'INTERVIEW_GUIDE',
  'CANDIDATE_RANKING',
  'SEARCH_INDEX',
  'CAREER_ANALYSIS'
);

CREATE TYPE "CandidateIntelligenceStatus" AS ENUM (
  'PENDING',
  'READY',
  'STALE',
  'FAILED',
  'DISABLED',
  'REVIEW_REQUIRED'
);

CREATE TABLE "CandidateIntelligenceState" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "kind" "CandidateIntelligenceKind" NOT NULL,
  "status" "CandidateIntelligenceStatus" NOT NULL DEFAULT 'PENDING',
  "latestExecutionId" TEXT,
  "latestResultId" TEXT,
  "latestResumeAssetId" TEXT,
  "latestImportItemId" TEXT,
  "sourceFingerprint" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "parserVersion" TEXT,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CandidateIntelligenceState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateIntelligenceState_organisationId_candidateId_kind_key" ON "CandidateIntelligenceState"("organisationId", "candidateId", "kind");
CREATE INDEX "CandidateIntelligenceState_organisationId_status_updatedAt_idx" ON "CandidateIntelligenceState"("organisationId", "status", "updatedAt");
CREATE INDEX "CandidateIntelligenceState_candidateId_kind_idx" ON "CandidateIntelligenceState"("candidateId", "kind");

ALTER TABLE "CandidateIntelligenceState"
  ADD CONSTRAINT "CandidateIntelligenceState_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateIntelligenceState"
  ADD CONSTRAINT "CandidateIntelligenceState_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateIntelligenceState"
  ADD CONSTRAINT "CandidateIntelligenceState_latestExecutionId_fkey"
  FOREIGN KEY ("latestExecutionId") REFERENCES "IntelligenceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateIntelligenceState"
  ADD CONSTRAINT "CandidateIntelligenceState_latestResultId_fkey"
  FOREIGN KEY ("latestResultId") REFERENCES "IntelligenceResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateIntelligenceState"
  ADD CONSTRAINT "CandidateIntelligenceState_latestResumeAssetId_fkey"
  FOREIGN KEY ("latestResumeAssetId") REFERENCES "ResumeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateIntelligenceState"
  ADD CONSTRAINT "CandidateIntelligenceState_latestImportItemId_fkey"
  FOREIGN KEY ("latestImportItemId") REFERENCES "ResumeImportItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
