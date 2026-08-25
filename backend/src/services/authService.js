import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { signToken, getTokenExpiryIso } from '../utils/jwt.js';
import { normalizeOfficeLocations } from '../utils/email.js';
import { serializeAuthSession, serializeRecruiterProfile, serializeUser } from '../serializers/index.js';
import { issueAuthToken, consumeAuthToken, peekAuthTokenByRawToken, issueNumericOtp, invalidTokenError } from './authTokenService.js';
import { sendEmailVerificationEmail, sendPasswordResetEmail, sendPasswordResetOtpEmail } from './emailService.js';

// Mirrors frontend/lib/roles.js's isSafeInternalPath() - only ever used to
// decide whether a client-supplied "return to this page after reset" hint
// is safe to echo back in a redirect target, never to grant access.
function isSafeInternalPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}
import { resolveMembershipForRequest } from './organisationAccessService.js';
import { assertInitialSetupCompleted } from './setupService.js';
import { touchCandidateLastActive } from './candidateActivityService.js';
import { assertEmailAllowedForEmployerType, buildRecruiterOrganisationCreateData, createRecruiterOrganisation } from './employerOnboardingService.js';

function buildCandidateProfileData(payload) {
  const fallbackName = payload.fullName?.trim() || payload.email.split('@')[0];
  return {
    fullName: fallbackName,
    location: payload.location || '',
    totalExperience: payload.totalExperience || 0,
    skills: payload.skills || [],
    sharedResumeSlug: slugify(`${fallbackName}-${Date.now()}`, { lower: true, strict: true }),
  };
}

async function getUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      recruiterProfile: { include: { organisation: true } },
      candidateProfile: true,
    },
  });
}

function ensureVerifiedUser(user) {
  if (!user.emailVerifiedAt) {
    const error = new Error('Please verify your email before logging in.');
    error.statusCode = 403;
    throw error;
  }
}

export async function registerUser(payload) {
  await assertInitialSetupCompleted();

  const role = payload.role === 'RECRUITER' ? 'RECRUITER' : 'CANDIDATE';

  // The employer-type domain check happens BEFORE the duplicate-email check
  // so registration attempts are rejected on the same footing regardless of
  // whether the email already exists - avoids leaking "this email exists"
  // information through a different error path per employer type.
  const classification = role === 'RECRUITER'
    ? await assertEmailAllowedForEmployerType(payload.email, payload.employerType)
    : null;

  const normalizedEmail = payload.email.toLowerCase().trim();
  const existingUser = await getUserByEmail(normalizedEmail);

  if (existingUser) {
    const error = new Error('This email is already registered. Please sign in instead.');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const organisation = role === 'RECRUITER'
      ? await createRecruiterOrganisation(tx, await buildRecruiterOrganisationCreateData(payload, classification, tx))
      : null;

    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        recruiterProfile: role === 'RECRUITER'
          ? {
              create: {
                organisationId: organisation.id,
                companyEmailDomain: classification.domain,
                officeLocations: [],
                profileCompleted: false,
              },
            }
          : undefined,
        candidateProfile: role === 'CANDIDATE'
          ? { create: buildCandidateProfileData(payload) }
          : undefined,
      },
    });

    if (organisation) {
      await tx.organisationMembership.create({
        data: {
          organisationId: organisation.id,
          userId: createdUser.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
    }

    return tx.user.findUnique({
      where: { id: createdUser.id },
      include: {
        recruiterProfile: { include: { organisation: true } },
        candidateProfile: true,
      },
    });
  });

  const { token } = await issueAuthToken(user.id, 'EMAIL_VERIFICATION');
  await sendEmailVerificationEmail(user.email, token);

  return {
    user: serializeUser(user, { includePrivate: true }),
    emailVerificationRequired: true,
  };
}

export async function updateRecruiterProfile(userId, payload) {
  const recruiter = await prisma.user.findUnique({
    where: { id: userId },
    include: { recruiterProfile: true },
  });

  if (!recruiter?.recruiterProfile) {
    const error = new Error('Recruiter profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const profile = await prisma.recruiterProfile.update({
    where: { userId },
    data: {
      companyName: payload.companyName,
      aboutCompany: payload.aboutCompany,
      industryDomain: payload.industryDomain,
      companyType: payload.companyType,
      headquartersLocation: payload.headquartersLocation,
      startedYear: payload.startedYear ? Number(payload.startedYear) : null,
      employeeCount: payload.employeeCount ? Number(payload.employeeCount) : null,
      branchCount: payload.branchCount ? Number(payload.branchCount) : null,
      officeLocations: normalizeOfficeLocations(payload.officeLocations),
      annualTurnover: payload.annualTurnover,
      designation: payload.designation,
      workingSince: payload.workingSince ? Number(payload.workingSince) : null,
      companySize: payload.companySize,
      website: payload.website,
      profileCompleted: Boolean(
        payload.companyName &&
        payload.industryDomain &&
        payload.companyType &&
        payload.headquartersLocation &&
        payload.designation
      ),
    },
  });

  return serializeRecruiterProfile(profile);
}

export async function loginUser(email, password) {
  const user = await getUserByEmail(email);

  if (!user) {
    const error = new Error('Invalid credentials.');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const error = new Error('Invalid credentials.');
    error.statusCode = 401;
    throw error;
  }

  ensureVerifiedUser(user);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: {
      recruiterProfile: { include: { organisation: true } },
      candidateProfile: true,
    },
  });

  if (updatedUser.candidateProfile) {
    await touchCandidateLastActive(updatedUser.candidateProfile.id);
  }

  const token = signToken({ userId: updatedUser.id, role: updatedUser.role, sessionVersion: updatedUser.sessionVersion });
  const { activeMembership } = await resolveMembershipForRequest(updatedUser);
  return {
    token,
    session: serializeAuthSession(updatedUser, getTokenExpiryIso(), activeMembership),
  };
}

export async function requestPasswordReset(email, requestContext = {}) {
  const user = await getUserByEmail(email);
  if (!user) {
    // Non-enumerating: identical response and timing-insensitive shape
    // whether or not the account exists.
    return { requested: true };
  }

  const context = {
    audience: requestContext.audience === 'employer' ? 'employer' : 'candidate',
    employerType: requestContext.audience === 'employer' ? (requestContext.employerType || null) : null,
    next: isSafeInternalPath(requestContext.next) ? requestContext.next : null,
  };

  const { token } = await issueAuthToken(user.id, 'PASSWORD_RESET', { context });
  await sendPasswordResetEmail(user.email, token);
  return { requested: true };
}

export async function createPasswordResetSession(token) {
  const consumedToken = await consumeAuthToken(token, 'PASSWORD_RESET', { includeUser: true });
  const context = { ...(consumedToken.context || {}), otpVerified: false, attempts: 0 };
  const { token: sessionToken, id: sessionId } = await issueAuthToken(consumedToken.user.id, 'PASSWORD_RESET_SESSION', { context });

  const { code } = await issueNumericOtp(consumedToken.user.id, { resetSessionTokenId: sessionId });
  await sendPasswordResetOtpEmail(consumedToken.user.email, code);

  return { token: sessionToken };
}

export async function resendPasswordResetOtp(sessionToken) {
  const session = await peekAuthTokenByRawToken(sessionToken, 'PASSWORD_RESET_SESSION');

  if (!session.userId) {
    throw invalidTokenError();
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    throw invalidTokenError();
  }

  const { code } = await issueNumericOtp(session.userId, { resetSessionTokenId: session.id });
  await prisma.authToken.update({
    where: { id: session.id },
    data: { context: { ...(session.context || {}), attempts: 0, otpVerified: false } },
  });
  await sendPasswordResetOtpEmail(user.email, code);

  return { resent: true };
}

const MAX_OTP_ATTEMPTS = 5;

export async function verifyPasswordResetOtp(sessionToken, code) {
  const session = await peekAuthTokenByRawToken(sessionToken, 'PASSWORD_RESET_SESSION');
  const attempts = session.context?.attempts || 0;

  if (attempts >= MAX_OTP_ATTEMPTS) {
    const error = new Error('Too many incorrect attempts. Request a new code.');
    error.statusCode = 429;
    throw error;
  }

  let otpToken;
  try {
    // Must match the exact string issueNumericOtp() hashed - see that
    // function's comment for why the session id is bound into the hash
    // input instead of hashing the bare (collision-prone) 6-digit code.
    otpToken = await consumeAuthToken(`${session.id}:${code}`, 'PASSWORD_RESET_OTP');
  } catch {
    otpToken = null;
  }

  const isBoundToThisSession = otpToken && otpToken.context?.resetSessionTokenId === session.id;

  if (!isBoundToThisSession) {
    await prisma.authToken.update({
      where: { id: session.id },
      data: { context: { ...(session.context || {}), attempts: attempts + 1 } },
    });
    const error = new Error('Incorrect verification code.');
    error.statusCode = 400;
    throw error;
  }

  await prisma.authToken.update({
    where: { id: session.id },
    data: { context: { ...(session.context || {}), otpVerified: true } },
  });

  return { verified: true };
}

export async function confirmPasswordReset(token, password) {
  const session = await peekAuthTokenByRawToken(token, 'PASSWORD_RESET_SESSION');

  if (!session.context?.otpVerified) {
    const error = new Error('Enter the emailed verification code before setting a new password.');
    error.statusCode = 400;
    throw error;
  }

  const consumedToken = await consumeAuthToken(token, 'PASSWORD_RESET_SESSION', { includeUser: true });
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: consumedToken.user.id },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
  });

  return {
    reset: true,
    audience: consumedToken.context?.audience || 'candidate',
    employerType: consumedToken.context?.employerType || null,
    next: consumedToken.context?.next || null,
  };
}

export async function requestEmailVerification(email) {
  const user = await getUserByEmail(email);
  if (!user || user.emailVerifiedAt) {
    return { requested: true };
  }

  const { token } = await issueAuthToken(user.id, 'EMAIL_VERIFICATION');
  await sendEmailVerificationEmail(user.email, token);
  return { requested: true };
}

export async function confirmEmailVerification(token) {
  const consumedToken = await consumeAuthToken(token, 'EMAIL_VERIFICATION', { includeUser: true });
  await prisma.user.update({
    where: { id: consumedToken.user.id },
    data: { emailVerifiedAt: new Date() },
  });

  return { verified: true };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    const error = new Error('Current password is incorrect.');
    error.statusCode = 401;
    throw error;
  }

  if (currentPassword === newPassword) {
    const error = new Error('New password must be different from the current password.');
    error.statusCode = 422;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
    include: {
      recruiterProfile: { include: { organisation: true } },
      candidateProfile: true,
    },
  });

  const token = signToken({ userId: updatedUser.id, role: updatedUser.role, sessionVersion: updatedUser.sessionVersion });
  const { activeMembership } = await resolveMembershipForRequest(updatedUser);
  return {
    token,
    session: serializeAuthSession(updatedUser, getTokenExpiryIso(), activeMembership),
  };
}

export async function logoutUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });

  return { loggedOut: true };
}
