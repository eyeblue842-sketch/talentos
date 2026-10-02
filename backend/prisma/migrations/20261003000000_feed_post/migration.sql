-- CreateEnum
CREATE TYPE "FeedPostStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" "FeedPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedPost_authorUserId_createdAt_idx" ON "FeedPost"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedPost_status_createdAt_idx" ON "FeedPost"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
