-- CreateEnum
CREATE TYPE "DirectMessageType" AS ENUM ('TEXT', 'FILE', 'IMAGE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE';

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "participantAUserId" TEXT NOT NULL,
    "participantBUserId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "participantALastReadAt" TIMESTAMP(3),
    "participantBLastReadAt" TIMESTAMP(3),
    "participantAUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "participantBUnreadCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "type" "DirectMessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "attachmentOriginalName" TEXT,
    "attachmentStorageKey" TEXT,
    "attachmentStorageProvider" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSizeBytes" INTEGER,
    "attachmentChecksumSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_pairKey_key" ON "DirectConversation"("pairKey");

-- CreateIndex
CREATE INDEX "DirectConversation_participantAUserId_lastMessageAt_idx" ON "DirectConversation"("participantAUserId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "DirectConversation_participantBUserId_lastMessageAt_idx" ON "DirectConversation"("participantBUserId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DirectMessage_senderUserId_createdAt_idx" ON "DirectMessage"("senderUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_deletedAt_createdAt_idx" ON "DirectMessage"("conversationId", "deletedAt", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_participantAUserId_fkey" FOREIGN KEY ("participantAUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_participantBUserId_fkey" FOREIGN KEY ("participantBUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
