ALTER TYPE "IntelligenceFeature" ADD VALUE IF NOT EXISTS 'SEMANTIC_SEARCH';

DO $$
BEGIN
  CREATE TYPE "SemanticSearchMode" AS ENUM (
    'KEYWORD',
    'BOOLEAN',
    'SEMANTIC',
    'HYBRID',
    'SIMILAR_CANDIDATE',
    'SIMILAR_JOB'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SemanticSearchExecutionStatus" AS ENUM (
    'PENDING',
    'READY',
    'FAILED',
    'PARTIAL',
    'DISABLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "SemanticSearchQuery" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "rawQuery" TEXT,
  "normalizedQuery" TEXT,
  "searchMode" "SemanticSearchMode" NOT NULL,
  "parsedQueryJson" JSONB,
  "intentJson" JSONB,
  "filtersJson" JSONB,
  "expansionJson" JSONB,
  "sourceCandidateId" TEXT,
  "sourceJobId" TEXT,
  "jobContextId" TEXT,
  "schemaVersion" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "expansionVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SemanticSearchQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SemanticSearchExecution" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "queryId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "status" "SemanticSearchExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "candidatePoolFingerprint" TEXT,
  "planJson" JSONB,
  "resultSummaryJson" JSONB,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "executionTimeMs" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "SemanticSearchExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedCandidateSearch" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rawQuery" TEXT,
  "searchMode" "SemanticSearchMode" NOT NULL,
  "filtersJson" JSONB NOT NULL,
  "sourceCandidateId" TEXT,
  "sourceJobId" TEXT,
  "jobContextId" TEXT,
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastExecutedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SavedCandidateSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SemanticSearchQuery_organisationId_createdAt_idx" ON "SemanticSearchQuery"("organisationId", "createdAt");
CREATE INDEX "SemanticSearchQuery_createdByUserId_createdAt_idx" ON "SemanticSearchQuery"("createdByUserId", "createdAt");
CREATE INDEX "SemanticSearchQuery_searchMode_createdAt_idx" ON "SemanticSearchQuery"("searchMode", "createdAt");
CREATE INDEX "SemanticSearchQuery_sourceCandidateId_createdAt_idx" ON "SemanticSearchQuery"("sourceCandidateId", "createdAt");
CREATE INDEX "SemanticSearchQuery_sourceJobId_createdAt_idx" ON "SemanticSearchQuery"("sourceJobId", "createdAt");

CREATE INDEX "SemanticSearchExecution_organisationId_status_createdAt_idx" ON "SemanticSearchExecution"("organisationId", "status", "createdAt");
CREATE INDEX "SemanticSearchExecution_queryId_createdAt_idx" ON "SemanticSearchExecution"("queryId", "createdAt");
CREATE INDEX "SemanticSearchExecution_createdByUserId_createdAt_idx" ON "SemanticSearchExecution"("createdByUserId", "createdAt");

CREATE INDEX "SavedCandidateSearch_organisationId_ownerUserId_updatedAt_idx" ON "SavedCandidateSearch"("organisationId", "ownerUserId", "updatedAt");
CREATE INDEX "SavedCandidateSearch_organisationId_isShared_isActive_updatedAt_idx" ON "SavedCandidateSearch"("organisationId", "isShared", "isActive", "updatedAt");

ALTER TABLE "SemanticSearchQuery"
  ADD CONSTRAINT "SemanticSearchQuery_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SemanticSearchQuery"
  ADD CONSTRAINT "SemanticSearchQuery_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SemanticSearchQuery"
  ADD CONSTRAINT "SemanticSearchQuery_sourceCandidateId_fkey"
  FOREIGN KEY ("sourceCandidateId") REFERENCES "CandidateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SemanticSearchQuery"
  ADD CONSTRAINT "SemanticSearchQuery_sourceJobId_fkey"
  FOREIGN KEY ("sourceJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SemanticSearchQuery"
  ADD CONSTRAINT "SemanticSearchQuery_jobContextId_fkey"
  FOREIGN KEY ("jobContextId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SemanticSearchExecution"
  ADD CONSTRAINT "SemanticSearchExecution_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SemanticSearchExecution"
  ADD CONSTRAINT "SemanticSearchExecution_queryId_fkey"
  FOREIGN KEY ("queryId") REFERENCES "SemanticSearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SemanticSearchExecution"
  ADD CONSTRAINT "SemanticSearchExecution_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedCandidateSearch"
  ADD CONSTRAINT "SavedCandidateSearch_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedCandidateSearch"
  ADD CONSTRAINT "SavedCandidateSearch_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedCandidateSearch"
  ADD CONSTRAINT "SavedCandidateSearch_sourceCandidateId_fkey"
  FOREIGN KEY ("sourceCandidateId") REFERENCES "CandidateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedCandidateSearch"
  ADD CONSTRAINT "SavedCandidateSearch_sourceJobId_fkey"
  FOREIGN KEY ("sourceJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedCandidateSearch"
  ADD CONSTRAINT "SavedCandidateSearch_jobContextId_fkey"
  FOREIGN KEY ("jobContextId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
