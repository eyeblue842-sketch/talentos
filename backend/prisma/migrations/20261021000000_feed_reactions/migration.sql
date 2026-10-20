-- CreateEnum
CREATE TYPE "FeedReactionType" AS ENUM ('LIKE', 'SHARE');

-- CreateTable
CREATE TABLE "FeedPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FeedReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedPostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedPostReaction_userId_createdAt_idx" ON "FeedPostReaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedPostReaction_postId_type_idx" ON "FeedPostReaction"("postId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FeedPostReaction_postId_userId_type_key" ON "FeedPostReaction"("postId", "userId", "type");

-- AddForeignKey
ALTER TABLE "FeedPostReaction" ADD CONSTRAINT "FeedPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPostReaction" ADD CONSTRAINT "FeedPostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

