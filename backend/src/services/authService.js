import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { signToken, getTokenExpiryIso } from '../utils/jwt.js';
import { getEmailDomain, isPersonalEmail, normalizeOfficeLocations } from '../utils/email.js';
import { serializeAuthSession, serializeRecruiterProfile, serializeUser } from '../serializers/index.js';
import { issueAuthToken, consumeAuthToken } from './authTokenService.js';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from './emailService.js';
import { resolveMembershipForRequest } from './organisationAccessService.js';
import { assertInitialSetupCompleted } from './setupService.js';
import { touchCandidateLastActive } from './candidateActivityService.js';

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

async function buildUniqueOrganisationSlug(baseValue) {
  const base = slugify(baseValue, { lower: true, strict: true }) || `org-${Date.now()}`;
  let slug = base;
  let counter = 1;

  while (await prisma.organisation.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }

  return slug;
}

async function buildRecruiterOrganisationData(payload) {
  const emailDomain = getEmailDomain(payload.email);
  const inferredName = payload.companyName?.trim() || emailDomain.split('.')[0];
  return {
    name: inferredName,
    slug: await buildUniqueOrganisationSlug(inferredName),
    website: payload.website || null,
  };
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

  if (role === 'RECRUITER' && isPersonalEmail(payload.email)) {
    const error = new Error('Recruiters must register with a company email address.');
    error.statusCode = 422;
    throw error;
  }

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
      ? await tx.organisation.create({ data: await buildRecruiterOrganisationData(payload) })
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
                companyEmailDomain: getEmailDomain(payload.email),
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
