-- Add server-side JWT invalidation support.
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Extend hashed token support for server-mediated auth flows.
ALTER TYPE "AuthTokenType" ADD VALUE 'PASSWORD_RESET_SESSION';
ALTER TYPE "AuthTokenType" ADD VALUE 'OAUTH_STATE';
ALTER TYPE "AuthTokenType" ADD VALUE 'OAUTH_HANDOFF';

ALTER TABLE "AuthToken"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "context" JSONB;
