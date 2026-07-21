-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- CreateEnum
CREATE TYPE "OrganisationUnitType" AS ENUM (
  'BUSINESS_UNIT',
  'DEPARTMENT',
  'DIVISION',
  'OFFICE_LOCATION',
  'COST_CENTER',
  'LEGAL_ENTITY'
);

-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organisation"
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganisationMembership"
ADD COLUMN "customRoleDefinitionId" TEXT;

-- CreateTable
CREATE TABLE "OrganisationUnit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" "OrganisationUnitType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "parentId" TEXT,
    "status" "OrganisationStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationSettings" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "timezone" TEXT,
    "currency" TEXT,
    "language" TEXT,
    "dateFormat" TEXT,
    "employmentTypes" JSONB,
    "workModes" JSONB,
    "experienceBands" JSONB,
    "defaultHiringWorkflow" JSONB,
    "defaultOfferWorkflow" JSONB,
    "interviewTemplates" JSONB,
    "offerTemplates" JSONB,
    "careerPageSettings" JSONB,
    "emailBranding" JSONB,
    "notificationDefaults" JSONB,
    "lookupSettings" JSONB,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationRoleDefinition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "baseRole" "OrganisationRole",
    "permissions" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationRoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "NotificationType" NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganisationMembership_customRoleDefinitionId_idx" ON "OrganisationMembership"("customRoleDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationUnit_organisationId_type_name_key" ON "OrganisationUnit"("organisationId", "type", "name");

-- CreateIndex
CREATE INDEX "OrganisationUnit_organisationId_type_status_idx" ON "OrganisationUnit"("organisationId", "type", "status");

-- CreateIndex
CREATE INDEX "OrganisationUnit_parentId_idx" ON "OrganisationUnit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationSettings_organisationId_key" ON "OrganisationSettings"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationRoleDefinition_organisationId_slug_key" ON "OrganisationRoleDefinition"("organisationId", "slug");

-- CreateIndex
CREATE INDEX "OrganisationRoleDefinition_organisationId_archivedAt_idx" ON "OrganisationRoleDefinition"("organisationId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_organisationId_key_channel_key" ON "NotificationTemplate"("organisationId", "key", "channel");

-- CreateIndex
CREATE INDEX "NotificationTemplate_organisationId_category_enabled_idx" ON "NotificationTemplate"("organisationId", "category", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_organisationId_key_key" ON "FeatureFlag"("organisationId", "key");

-- CreateIndex
CREATE INDEX "FeatureFlag_organisationId_enabled_idx" ON "FeatureFlag"("organisationId", "enabled");

-- AddForeignKey
ALTER TABLE "OrganisationMembership"
ADD CONSTRAINT "OrganisationMembership_customRoleDefinitionId_fkey"
FOREIGN KEY ("customRoleDefinitionId") REFERENCES "OrganisationRoleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationUnit"
ADD CONSTRAINT "OrganisationUnit_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationUnit"
ADD CONSTRAINT "OrganisationUnit_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "OrganisationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationSettings"
ADD CONSTRAINT "OrganisationSettings_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationSettings"
ADD CONSTRAINT "OrganisationSettings_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationRoleDefinition"
ADD CONSTRAINT "OrganisationRoleDefinition_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationRoleDefinition"
ADD CONSTRAINT "OrganisationRoleDefinition_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationRoleDefinition"
ADD CONSTRAINT "OrganisationRoleDefinition_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate"
ADD CONSTRAINT "NotificationTemplate_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate"
ADD CONSTRAINT "NotificationTemplate_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag"
ADD CONSTRAINT "FeatureFlag_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag"
ADD CONSTRAINT "FeatureFlag_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
