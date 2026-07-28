CREATE TYPE "JobDescriptionDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'APPLIED', 'ARCHIVED');

CREATE TYPE "JobDescriptionTemplateScope" AS ENUM ('SYSTEM', 'ORGANISATION');

CREATE TABLE "JobDescriptionTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "scope" "JobDescriptionTemplateScope" NOT NULL DEFAULT 'ORGANISATION',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeVersionId" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDescriptionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobDescriptionTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT,
    "content" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "promptKey" TEXT,
    "promptVersion" TEXT,
    "sourceResultId" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDescriptionTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobDescriptionDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "versionGroupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousVersionId" TEXT,
    "status" "JobDescriptionDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "content" JSONB NOT NULL,
    "jobSnapshot" JSONB,
    "sourceStateId" TEXT,
    "sourceExecutionId" TEXT,
    "sourceResultId" TEXT,
    "templateId" TEXT,
    "templateVersionId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" TEXT,
    "appliedJobSnapshot" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDescriptionDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobDescriptionTemplate_organisationId_key_key" ON "JobDescriptionTemplate"("organisationId", "key");
CREATE INDEX "JobDescriptionTemplate_scope_isActive_archivedAt_idx" ON "JobDescriptionTemplate"("scope", "isActive", "archivedAt");
CREATE INDEX "JobDescriptionTemplate_organisationId_isActive_archivedAt_idx" ON "JobDescriptionTemplate"("organisationId", "isActive", "archivedAt");

CREATE UNIQUE INDEX "JobDescriptionTemplateVersion_templateId_version_key" ON "JobDescriptionTemplateVersion"("templateId", "version");
CREATE INDEX "JobDescriptionTemplateVersion_templateId_createdAt_idx" ON "JobDescriptionTemplateVersion"("templateId", "createdAt");

CREATE UNIQUE INDEX "JobDescriptionDraft_versionGroupId_version_key" ON "JobDescriptionDraft"("versionGroupId", "version");
CREATE INDEX "JobDescriptionDraft_organisationId_jobId_isLatestVersion_createdAt_idx" ON "JobDescriptionDraft"("organisationId", "jobId", "isLatestVersion", "createdAt");
CREATE INDEX "JobDescriptionDraft_organisationId_status_updatedAt_idx" ON "JobDescriptionDraft"("organisationId", "status", "updatedAt");
CREATE INDEX "JobDescriptionDraft_jobId_versionGroupId_version_idx" ON "JobDescriptionDraft"("jobId", "versionGroupId", "version");
CREATE INDEX "JobDescriptionDraft_templateId_idx" ON "JobDescriptionDraft"("templateId");

ALTER TABLE "JobDescriptionTemplate"
    ADD CONSTRAINT "JobDescriptionTemplate_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplate"
    ADD CONSTRAINT "JobDescriptionTemplate_activeVersionId_fkey"
    FOREIGN KEY ("activeVersionId") REFERENCES "JobDescriptionTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplate"
    ADD CONSTRAINT "JobDescriptionTemplate_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplate"
    ADD CONSTRAINT "JobDescriptionTemplate_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplate"
    ADD CONSTRAINT "JobDescriptionTemplate_activatedByUserId_fkey"
    FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplateVersion"
    ADD CONSTRAINT "JobDescriptionTemplateVersion_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "JobDescriptionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplateVersion"
    ADD CONSTRAINT "JobDescriptionTemplateVersion_sourceResultId_fkey"
    FOREIGN KEY ("sourceResultId") REFERENCES "IntelligenceResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionTemplateVersion"
    ADD CONSTRAINT "JobDescriptionTemplateVersion_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_previousVersionId_fkey"
    FOREIGN KEY ("previousVersionId") REFERENCES "JobDescriptionDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_sourceStateId_fkey"
    FOREIGN KEY ("sourceStateId") REFERENCES "JobDescriptionState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_sourceExecutionId_fkey"
    FOREIGN KEY ("sourceExecutionId") REFERENCES "IntelligenceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_sourceResultId_fkey"
    FOREIGN KEY ("sourceResultId") REFERENCES "IntelligenceResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "JobDescriptionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_templateVersionId_fkey"
    FOREIGN KEY ("templateVersionId") REFERENCES "JobDescriptionTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_appliedByUserId_fkey"
    FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionDraft"
    ADD CONSTRAINT "JobDescriptionDraft_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
