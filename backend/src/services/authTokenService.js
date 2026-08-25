import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

function buildTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function invalidTokenError() {
  const error = new Error('Invalid or expired token.');
  error.statusCode = 400;
  return error;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function issueAuthToken(userId, type, options = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = options.expiresAt
    || (
      type === 'PASSWORD_RESET'
        ? addMinutes(now, env.passwordResetTtlMinutes)
        : type === 'PASSWORD_RESET_SESSION'
          ? addMinutes(now, 10)
          : type === 'OAUTH_STATE'
            ? addMinutes(now, 10)
            : type === 'OAUTH_HANDOFF'
              ? addMinutes(now, 5)
              : addHours(now, env.emailVerificationTtlHours)
    );

  if (userId && options.invalidateExisting !== false) {
    await prisma.authToken.updateMany({
      where: { userId, type, consumedAt: null },
      data: { consumedAt: now },
    });
  }

  const created = await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: buildTokenHash(token),
      context: options.context,
      expiresAt,
    },
  });

  return { token, expiresAt, id: created.id };
}

// Looks up an AuthToken by its raw (unhashed) value WITHOUT consuming it -
// used by the OTP-verification step, which must be able to re-check the
// same reset-session token across multiple requests (one per OTP attempt)
// before the session is finally consumed at password-confirm time.
export async function peekAuthTokenByRawToken(token, type) {
  const tokenHash = buildTokenHash(token);
  const record = await prisma.authToken.findUnique({ where: { tokenHash } });

  if (!record || record.type !== type || record.consumedAt || record.expiresAt <= new Date()) {
    throw invalidTokenError();
  }

  return record;
}

// A short numeric (not the generic 32-byte hex) token, mailed to the user as
// a 6-digit code rather than embedded in a link. Hashed and stored the same
// way as every other AuthToken so it is verified through the same single-use,
// race-safe consumeAuthToken() path as the reset link itself.
// The stored tokenHash is derived from `${resetSessionTokenId}:${code}`, not
// the bare code - a 6-digit code only has 1,000,000 possible values, so two
// unrelated concurrent reset sessions could otherwise land on the same
// displayed code and either collide on AuthToken.tokenHash's unique
// constraint or let one session's guess consume a different user's OTP.
// Binding the session id into what actually gets hashed keeps the code the
// user sees short while keeping every stored hash unique.
export async function issueNumericOtp(userId, context = {}) {
  if (!context.resetSessionTokenId) {
    throw new Error('issueNumericOtp requires context.resetSessionTokenId.');
  }

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  const now = new Date();
  const expiresAt = addMinutes(now, 10);

  await prisma.authToken.updateMany({
    where: { userId, type: 'PASSWORD_RESET_OTP', consumedAt: null },
    data: { consumedAt: now },
  });

  await prisma.authToken.create({
    data: {
      userId,
      type: 'PASSWORD_RESET_OTP',
      tokenHash: buildTokenHash(`${context.resetSessionTokenId}:${code}`),
      context,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function consumeAuthToken(token, type, options = {}) {
  const tokenHash = buildTokenHash(token);
  const now = new Date();

  const authToken = await prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: {
        tokenHash,
        type,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      throw invalidTokenError();
    }

    return tx.authToken.findUnique({
      where: { tokenHash },
      include: options.includeUser
        ? { user: { include: { recruiterProfile: true, candidateProfile: true } } }
        : undefined,
    });
  });

  if (!authToken) {
    throw invalidTokenError();
  }

  if (options.includeUser && !authToken.user) {
    throw invalidTokenError();
  }

  return authToken;
}
