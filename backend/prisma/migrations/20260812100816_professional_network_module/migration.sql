-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NETWORK';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectionStatus') THEN
    CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectionSource') THEN
    CREATE TYPE "ConnectionSource" AS ENUM ('PROFILE', 'PEOPLE_SEARCH', 'JOB', 'COMPANY', 'SUGGESTION', 'MUTUAL_CONNECTION');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectionRequestPermission') THEN
    CREATE TYPE "ConnectionRequestPermission" AS ENUM ('EVERYONE', 'RECRUITERS_ONLY', 'NOBODY');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectionVisibility') THEN
    CREATE TYPE "ConnectionVisibility" AS ENUM ('EVERYONE', 'CONNECTIONS_ONLY', 'NOBODY');
  END IF;
END $$;

-- CreateTable
CREATE TABLE "NetworkPrivacySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allowConnectionRequestsFrom" "ConnectionRequestPermission" NOT NULL DEFAULT 'EVERYONE',
    "connectionVisibility" "ConnectionVisibility" NOT NULL DEFAULT 'CONNECTIONS_ONLY',
    "showInPeopleSearch" BOOLEAN NOT NULL DEFAULT true,
    "showRecruiterIdentity" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkPrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConnection" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ConnectionSource" NOT NULL DEFAULT 'PROFILE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "UserConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPrivacySettings_userId_key" ON "NetworkPrivacySettings"("userId");

-- CreateIndex
CREATE INDEX "NetworkPrivacySettings_showInPeopleSearch_idx" ON "NetworkPrivacySettings"("showInPeopleSearch");

-- CreateIndex
CREATE UNIQUE INDEX "UserConnection_pairKey_key" ON "UserConnection"("pairKey");

-- CreateIndex
CREATE INDEX "UserConnection_requesterUserId_status_createdAt_idx" ON "UserConnection"("requesterUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UserConnection_receiverUserId_status_createdAt_idx" ON "UserConnection"("receiverUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UserConnection_status_acceptedAt_idx" ON "UserConnection"("status", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerUserId_blockedUserId_key" ON "UserBlock"("blockerUserId", "blockedUserId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedUserId_blockerUserId_idx" ON "UserBlock"("blockedUserId", "blockerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFollow_userId_organisationId_key" ON "CompanyFollow"("userId", "organisationId");

-- CreateIndex
CREATE INDEX "CompanyFollow_organisationId_createdAt_idx" ON "CompanyFollow"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "NetworkPrivacySettings" ADD CONSTRAINT "NetworkPrivacySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFollow" ADD CONSTRAINT "CompanyFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFollow" ADD CONSTRAINT "CompanyFollow_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
