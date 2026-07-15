import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

function buildTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function invalidTokenError() {
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

  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: buildTokenHash(token),
      context: options.context,
      expiresAt,
    },
  });

  return { token, expiresAt };
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
