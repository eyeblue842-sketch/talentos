import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { signToken, getTokenExpiryIso } from '../utils/jwt.js';
import { getEmailDomain, isPersonalEmail, normalizeOfficeLocations } from '../utils/email.js';
import { serializeAuthSession, serializeRecruiterProfile, serializeUser } from '../serializers/index.js';
import { issueAuthToken, consumeAuthToken } from './authTokenService.js';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from './emailService.js';

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
    include: { recruiterProfile: true, candidateProfile: true },
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
  if (payload.role === 'RECRUITER' && isPersonalEmail(payload.email)) {
    const error = new Error('Recruiters must register with a company email address.');
    error.statusCode = 422;
    throw error;
  }

  const normalizedEmail = payload.email.toLowerCase().trim();
  const existingUser = await getUserByEmail(normalizedEmail);

  if (existingUser) {
    const error = new Error('This company email is already registered with us. Please login instead.');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: hashedPassword,
      role: payload.role,
      recruiterProfile: payload.role === 'RECRUITER'
        ? {
            create: {
              companyEmailDomain: getEmailDomain(payload.email),
              officeLocations: [],
              profileCompleted: false,
            },
          }
        : undefined,
      candidateProfile: payload.role === 'CANDIDATE'
        ? { create: buildCandidateProfileData(payload) }
        : undefined,
    },
    include: {
      recruiterProfile: true,
      candidateProfile: true,
    },
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

  const token = signToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion });
  return {
    token,
    session: serializeAuthSession(user, getTokenExpiryIso()),
  };
}

export async function requestPasswordReset(email) {
  const user = await getUserByEmail(email);
  if (!user) {
    return { requested: true };
  }

  const { token } = await issueAuthToken(user.id, 'PASSWORD_RESET');
  await sendPasswordResetEmail(user.email, token);
  return { requested: true };
}

export async function createPasswordResetSession(token) {
  const consumedToken = await consumeAuthToken(token, 'PASSWORD_RESET', { includeUser: true });
  const { token: sessionToken } = await issueAuthToken(consumedToken.user.id, 'PASSWORD_RESET_SESSION');
  return { token: sessionToken };
}

export async function confirmPasswordReset(token, password) {
  const consumedToken = await consumeAuthToken(token, 'PASSWORD_RESET_SESSION', { includeUser: true });
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: consumedToken.user.id },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
  });

  return { reset: true };
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

export async function logoutUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });

  return { loggedOut: true };
}
