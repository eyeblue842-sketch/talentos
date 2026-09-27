-- Candidate invites (Naukri NVite equivalent): one row per structured outreach send.
CREATE TABLE "CandidateInvite" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipientEmails" TEXT[],
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CandidateInvite_organisationId_createdAt_idx" ON "CandidateInvite"("organisationId", "createdAt");
CREATE INDEX "CandidateInvite_jobId_idx" ON "CandidateInvite"("jobId");

ALTER TABLE "CandidateInvite" ADD CONSTRAINT "CandidateInvite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateInvite" ADD CONSTRAINT "CandidateInvite_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateInvite" ADD CONSTRAINT "CandidateInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
