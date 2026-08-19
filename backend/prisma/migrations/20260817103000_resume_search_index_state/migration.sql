-- AlterEnum
ALTER TYPE "BackgroundTaskType" ADD VALUE IF NOT EXISTS 'RESUME_SEARCH_INDEX_SYNC';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResumeSearchIndexStatus') THEN
    CREATE TYPE "ResumeSearchIndexStatus" AS ENUM ('PENDING', 'INDEXED', 'RETRY_SCHEDULED', 'FAILED', 'DELETED', 'SKIPPED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE "ResumeSearchIndexState" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "resumeId" TEXT,
    "sourceVersion" TEXT NOT NULL,
    "indexSchemaVersion" TEXT NOT NULL,
    "status" "ResumeSearchIndexStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "engineDocumentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeSearchIndexState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeSearchIndexState_candidateId_indexSchemaVersion_key" ON "ResumeSearchIndexState"("candidateId", "indexSchemaVersion");
CREATE INDEX "ResumeSearchIndexState_status_updatedAt_idx" ON "ResumeSearchIndexState"("status", "updatedAt");
CREATE INDEX "ResumeSearchIndexState_resumeId_idx" ON "ResumeSearchIndexState"("resumeId");
CREATE INDEX "ResumeSearchIndexState_lastErrorAt_idx" ON "ResumeSearchIndexState"("lastErrorAt");

-- AddForeignKey
ALTER TABLE "ResumeSearchIndexState" ADD CONSTRAINT "ResumeSearchIndexState_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeSearchIndexState" ADD CONSTRAINT "ResumeSearchIndexState_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "ResumeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
