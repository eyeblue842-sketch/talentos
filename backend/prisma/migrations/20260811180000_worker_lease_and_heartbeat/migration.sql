-- AlterTable: add lease/heartbeat tracking to BackgroundTask
ALTER TABLE "BackgroundTask" ADD COLUMN "leaseOwnerId" TEXT;
ALTER TABLE "BackgroundTask" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "BackgroundTask" ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BackgroundTask_status_leaseExpiresAt_idx" ON "BackgroundTask"("status", "leaseExpiresAt");

-- CreateEnum
CREATE TYPE "WorkerHeartbeatStatus" AS ENUM ('IDLE', 'PROCESSING', 'STOPPING', 'STOPPED');

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workerType" TEXT NOT NULL DEFAULT 'BACKGROUND_WORKER',
    "hostname" TEXT,
    "processId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkerHeartbeatStatus" NOT NULL DEFAULT 'IDLE',
    "currentTaskId" TEXT,
    "parserVersion" TEXT,
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerHeartbeat_workerId_key" ON "WorkerHeartbeat"("workerId");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_lastHeartbeatAt_idx" ON "WorkerHeartbeat"("lastHeartbeatAt");
