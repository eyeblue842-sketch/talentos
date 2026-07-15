-- Alter users with explicit email verification tracking.
ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Persist hashed single-use auth tokens for reset and verification flows.
CREATE TYPE "AuthTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TABLE "AuthToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AuthTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

ALTER TABLE "AuthToken"
ADD CONSTRAINT "AuthToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
