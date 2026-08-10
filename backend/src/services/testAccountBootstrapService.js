import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { getEmailDomain } from '../utils/email.js';

const ELEVATABLE_CANDIDATE_ROLES = ['CANDIDATE', 'CANDIDATE_ADMIN'];
const ELEVATABLE_RECRUITER_ROLES = ['RECRUITER', 'RECRUITER_ADMIN'];

function refuse(email, currentRole) {
  const error = new Error(
    `Refusing to bootstrap ${email}: existing role "${currentRole}" is not a role this bootstrap is allowed to elevate. Resolve manually.`
  );
  error.statusCode = 409;
  throw error;
}

/**
 * Finds-or-creates the CANDIDATE_ADMIN test account. Never deletes or
 * overwrites an existing CandidateProfile - only creates one (via the same
 * minimal shape authService.registerUser uses) if the user exists without
 * one. Reruns are safe: role/password/mustChangePassword are the only fields
 * ever mutated on an existing row.
 */
export async function bootstrapCandidateAdminAccount({ email, passwordHash }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { candidateProfile: true },
  });

  if (existing) {
    if (!ELEVATABLE_CANDIDATE_ROLES.includes(existing.role)) {
      refuse(normalizedEmail, existing.role);
    }

    const data = {
      role: 'CANDIDATE_ADMIN',
      passwordHash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    };
    if (!existing.emailVerifiedAt) {
      data.emailVerifiedAt = new Date();
    }

    const candidateProfileCreated = !existing.candidateProfile;
    if (candidateProfileCreated) {
      const fallbackName = normalizedEmail.split('@')[0];
      data.candidateProfile = {
        create: {
          fullName: fallbackName,
          location: '',
          totalExperience: 0,
          skills: [],
          sharedResumeSlug: slugify(`${fallbackName}-${Date.now()}`, { lower: true, strict: true }),
        },
      };
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
      include: { candidateProfile: true },
    });

    return {
      created: false,
      userId: updated.id,
      email: updated.email,
      roleBefore: existing.role,
      roleAfter: updated.role,
      candidateProfileId: updated.candidateProfile?.id || null,
      candidateProfileCreated,
    };
  }

  const fallbackName = normalizedEmail.split('@')[0];
  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: 'CANDIDATE_ADMIN',
      mustChangePassword: true,
      emailVerifiedAt: new Date(),
      candidateProfile: {
        create: {
          fullName: fallbackName,
          location: '',
          totalExperience: 0,
          skills: [],
          sharedResumeSlug: slugify(`${fallbackName}-${Date.now()}`, { lower: true, strict: true }),
        },
      },
    },
    include: { candidateProfile: true },
  });

  return {
    created: true,
    userId: created.id,
    email: created.email,
    roleBefore: null,
    roleAfter: created.role,
    candidateProfileId: created.candidateProfile?.id || null,
    candidateProfileCreated: true,
  };
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

/**
 * Finds-or-creates the RECRUITER_ADMIN test account. A brand-new account gets
 * a real Organisation + RecruiterProfile + OrganisationMembership (OWNER),
 * mirroring authService.registerUser's RECRUITER path, because the admin
 * panel this role unlocks resolves access through a real organisation
 * membership rather than a global bypass. An existing recruiter's
 * organisation/membership is never touched.
 */
export async function bootstrapRecruiterAdminAccount({ email, passwordHash }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { recruiterProfile: { include: { organisation: true } } },
  });

  if (existing) {
    if (!ELEVATABLE_RECRUITER_ROLES.includes(existing.role)) {
      refuse(normalizedEmail, existing.role);
    }

    const data = {
      role: 'RECRUITER_ADMIN',
      passwordHash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    };
    if (!existing.emailVerifiedAt) {
      data.emailVerifiedAt = new Date();
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
      include: { recruiterProfile: { include: { organisation: true } } },
    });

    return {
      created: false,
      userId: updated.id,
      email: updated.email,
      roleBefore: existing.role,
      roleAfter: updated.role,
      organisationId: updated.recruiterProfile?.organisationId || null,
      organisationCreated: false,
    };
  }

  const emailDomain = getEmailDomain(normalizedEmail);
  const inferredName = emailDomain.split('.')[0];
  const organisationSlug = await buildUniqueOrganisationSlug(inferredName);

  const result = await prisma.$transaction(async (tx) => {
    const organisation = await tx.organisation.create({
      data: { name: inferredName, slug: organisationSlug },
    });

    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'RECRUITER_ADMIN',
        mustChangePassword: true,
        emailVerifiedAt: new Date(),
        recruiterProfile: {
          create: {
            organisationId: organisation.id,
            companyEmailDomain: emailDomain,
            officeLocations: [],
            profileCompleted: false,
          },
        },
      },
    });

    await tx.organisationMembership.create({
      data: {
        organisationId: organisation.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    return { user, organisation };
  });

  return {
    created: true,
    userId: result.user.id,
    email: result.user.email,
    roleBefore: null,
    roleAfter: result.user.role,
    organisationId: result.organisation.id,
    organisationCreated: true,
  };
}
