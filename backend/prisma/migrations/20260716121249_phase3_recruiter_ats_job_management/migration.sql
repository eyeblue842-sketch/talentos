/*
  Warnings:

  - Added the required column `updatedAt` to the `ApplicationActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AtsNote` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'DRAFT';
ALTER TYPE "JobStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "JobStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "ApplicationActivity" ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "eventType" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AtsNote" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "InterviewRound" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "meetingLocation" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applicationDeadline" TIMESTAMP(3),
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "businessUnit" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "hiringManagerId" TEXT,
ADD COLUMN     "numberOfOpenings" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workplaceType" "WorkplaceType";

-- CreateIndex
CREATE INDEX "ApplicationActivity_actorUserId_createdAt_idx" ON "ApplicationActivity"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_hiringManagerId_idx" ON "Job"("hiringManagerId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationActivity" ADD CONSTRAINT "ApplicationActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Align the backfill-safe defaults with the Prisma schema after existing rows are populated.
ALTER TABLE "ApplicationActivity" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AtsNote" ALTER COLUMN "updatedAt" DROP DEFAULT;
