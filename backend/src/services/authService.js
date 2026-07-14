import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { getEmailDomain, isPersonalEmail, normalizeOfficeLocations } from '../utils/email.js';

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function registerUser(payload) {
  if (payload.role === 'RECRUITER' && isPersonalEmail(payload.email)) {
    const error = new Error('Recruiters must register with a company email address.');
    error.statusCode = 422;
    throw error;
  }

  const normalizedEmail = payload.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error = new Error('This company email is already registered with us. Please login instead.');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

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
        ? {
            create: {
              fullName: payload.fullName,
              location: payload.location || '',
              totalExperience: payload.totalExperience || 0,
              skills: payload.skills || [],
              sharedResumeSlug: slugify(`${payload.fullName}-${Date.now()}`, { lower: true, strict: true }),
            },
          }
        : undefined,
    },
    include: {
      recruiterProfile: true,
      candidateProfile: true,
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
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

  return prisma.recruiterProfile.update({
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
        payload.designation,
      ),
    },
  });
}

export async function loginUser(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { recruiterProfile: true, candidateProfile: true },
  });

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

  const token = signToken({ userId: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
}
