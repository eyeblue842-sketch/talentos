-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformSetupState" (
  "id" TEXT NOT NULL DEFAULT 'platform-setup',
  "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
  "setupVersion" TEXT,
  "setupCompletedAt" TIMESTAMP(3),
  "setupCompletedBy" TEXT,
  "lastResetAt" TIMESTAMP(3),
  "lastResetBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSetupState_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformSetupState_setupCompleted_setupCompletedAt_idx" ON "PlatformSetupState"("setupCompleted", "setupCompletedAt");

-- AddForeignKey
ALTER TABLE "PlatformSetupState"
ADD CONSTRAINT "PlatformSetupState_setupCompletedBy_fkey"
FOREIGN KEY ("setupCompletedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlatformSetupState"
ADD CONSTRAINT "PlatformSetupState_lastResetBy_fkey"
FOREIGN KEY ("lastResetBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
