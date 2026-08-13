import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { PrismaClient } from '@prisma/client';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../.env') });

const prisma = new PrismaClient();

const USERS = {
  candidateA: {
    email: 'e2e.messaging.candidate.a@careeriz.demo',
    fullName: 'E2E Candidate A',
    headline: 'Frontend Engineer',
    designation: 'Frontend Engineer',
    company: 'E2E Talent Lab',
    location: 'Bengaluru',
    skills: ['React', 'Next.js', 'Node.js'],
  },
  candidateB: {
    email: 'e2e.messaging.candidate.b@careeriz.demo',
    fullName: 'E2E Candidate B',
    headline: 'Backend Engineer',
    designation: 'Backend Engineer',
    company: 'E2E Data Systems',
    location: 'Pune',
    skills: ['Node.js', 'PostgreSQL', 'TypeScript'],
  },
  recruiterA: {
    email: 'e2e.messaging.recruiter.a@careeriz.demo',
    fullName: 'E2E Recruiter A',
    designation: 'Senior Talent Acquisition Manager',
    company: 'E2E Talent Lab',
    location: 'Bengaluru',
  },
};

const PASSWORD = 'Password@123';
const ORG_SLUG = 'e2e-talent-lab';
const JOB_SLUG = slugify('E2E Frontend Engineer Talent Lab', { lower: true, strict: true });

function buildPairKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(':');
}

async function upsertUser(email, role, name, passwordHash) {
  return prisma.user.upsert({
    where: { email },
    update: {
      role,
      name,
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 0,
    },
    create: {
      email,
      role,
      name,
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 0,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const organisation = await prisma.organisation.upsert({
    where: { slug: ORG_SLUG },
    update: {
      name: 'E2E Talent Lab',
      status: 'ACTIVE',
      headquarters: 'Bengaluru',
      careersEnabled: true,
      publicDescription: 'E2E messaging verification organisation.',
    },
    create: {
      name: 'E2E Talent Lab',
      slug: ORG_SLUG,
      status: 'ACTIVE',
      headquarters: 'Bengaluru',
      careersEnabled: true,
      publicDescription: 'E2E messaging verification organisation.',
    },
  });

  const candidateAUser = await upsertUser(USERS.candidateA.email, 'CANDIDATE', USERS.candidateA.fullName, passwordHash);
  const candidateBUser = await upsertUser(USERS.candidateB.email, 'CANDIDATE', USERS.candidateB.fullName, passwordHash);
  const recruiterAUser = await upsertUser(USERS.recruiterA.email, 'RECRUITER', USERS.recruiterA.fullName, passwordHash);

  const targetUserIds = [candidateAUser.id, candidateBUser.id, recruiterAUser.id];

  await prisma.notification.deleteMany({
    where: {
      OR: [
        { recipientUserId: { in: targetUserIds } },
        { entityId: { in: targetUserIds } },
      ],
    },
  }).catch(() => null);

  await prisma.directMessage.deleteMany({
    where: {
      OR: [
        { senderUserId: { in: targetUserIds } },
        {
          conversation: {
            OR: [
              { participantAUserId: { in: targetUserIds } },
              { participantBUserId: { in: targetUserIds } },
            ],
          },
        },
      ],
    },
  });

  await prisma.directConversation.deleteMany({
    where: {
      OR: [
        { participantAUserId: { in: targetUserIds } },
        { participantBUserId: { in: targetUserIds } },
      ],
    },
  });

  await prisma.userBlock.deleteMany({
    where: {
      OR: [
        { blockerUserId: { in: targetUserIds } },
        { blockedUserId: { in: targetUserIds } },
      ],
    },
  });

  await prisma.userConnection.deleteMany({
    where: {
      OR: [
        { requesterUserId: { in: targetUserIds } },
        { receiverUserId: { in: targetUserIds } },
      ],
    },
  });

  for (const userId of targetUserIds) {
    await prisma.networkPrivacySettings.upsert({
      where: { userId },
      update: {
        allowConnectionRequestsFrom: 'EVERYONE',
        connectionVisibility: 'CONNECTIONS_ONLY',
        showInPeopleSearch: true,
        showRecruiterIdentity: true,
      },
      create: {
        userId,
        allowConnectionRequestsFrom: 'EVERYONE',
        connectionVisibility: 'CONNECTIONS_ONLY',
        showInPeopleSearch: true,
        showRecruiterIdentity: true,
      },
    });
  }

  await prisma.candidateProfile.upsert({
    where: { userId: candidateAUser.id },
    update: {
      fullName: USERS.candidateA.fullName,
      headline: USERS.candidateA.headline,
      currentTitle: USERS.candidateA.designation,
      currentDesignation: USERS.candidateA.designation,
      currentEmployer: USERS.candidateA.company,
      location: USERS.candidateA.location,
      totalExperience: 4,
      skills: USERS.candidateA.skills,
      profileVisibility: 'PUBLIC',
      recommendationEnabled: true,
      sharedResumeSlug: 'e2e-candidate-a-resume',
    },
    create: {
      userId: candidateAUser.id,
      fullName: USERS.candidateA.fullName,
      headline: USERS.candidateA.headline,
      currentTitle: USERS.candidateA.designation,
      currentDesignation: USERS.candidateA.designation,
      currentEmployer: USERS.candidateA.company,
      location: USERS.candidateA.location,
      preferredLocations: [USERS.candidateA.location, 'Remote'],
      totalExperience: 4,
      skills: USERS.candidateA.skills,
      profileVisibility: 'PUBLIC',
      recommendationEnabled: true,
      sharedResumeSlug: 'e2e-candidate-a-resume',
    },
  });

  await prisma.candidateProfile.upsert({
    where: { userId: candidateBUser.id },
    update: {
      fullName: USERS.candidateB.fullName,
      headline: USERS.candidateB.headline,
      currentTitle: USERS.candidateB.designation,
      currentDesignation: USERS.candidateB.designation,
      currentEmployer: USERS.candidateB.company,
      location: USERS.candidateB.location,
      totalExperience: 5,
      skills: USERS.candidateB.skills,
      profileVisibility: 'PUBLIC',
      recommendationEnabled: true,
      sharedResumeSlug: 'e2e-candidate-b-resume',
    },
    create: {
      userId: candidateBUser.id,
      fullName: USERS.candidateB.fullName,
      headline: USERS.candidateB.headline,
      currentTitle: USERS.candidateB.designation,
      currentDesignation: USERS.candidateB.designation,
      currentEmployer: USERS.candidateB.company,
      location: USERS.candidateB.location,
      preferredLocations: [USERS.candidateB.location, 'Remote'],
      totalExperience: 5,
      skills: USERS.candidateB.skills,
      profileVisibility: 'PUBLIC',
      recommendationEnabled: true,
      sharedResumeSlug: 'e2e-candidate-b-resume',
    },
  });

  await prisma.recruiterProfile.upsert({
    where: { userId: recruiterAUser.id },
    update: {
      organisationId: organisation.id,
      companyEmailDomain: 'careeriz.demo',
      companyName: USERS.recruiterA.company,
      industryDomain: 'Information Technology',
      headquartersLocation: USERS.recruiterA.location,
      designation: USERS.recruiterA.designation,
      officeLocations: [USERS.recruiterA.location],
      profileCompleted: true,
    },
    create: {
      userId: recruiterAUser.id,
      organisationId: organisation.id,
      companyEmailDomain: 'careeriz.demo',
      companyName: USERS.recruiterA.company,
      industryDomain: 'Information Technology',
      headquartersLocation: USERS.recruiterA.location,
      designation: USERS.recruiterA.designation,
      officeLocations: [USERS.recruiterA.location],
      profileCompleted: true,
    },
  });

  await prisma.organisationMembership.upsert({
    where: {
      organisationId_userId: {
        organisationId: organisation.id,
        userId: recruiterAUser.id,
      },
    },
    update: {
      role: 'OWNER',
      status: 'ACTIVE',
    },
    create: {
      organisationId: organisation.id,
      userId: recruiterAUser.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.platformSetupState.upsert({
    where: { id: 'platform-setup' },
    update: {
      setupCompleted: true,
      setupVersion: '9.0.0',
      setupCompletedAt: new Date(),
      setupCompletedBy: recruiterAUser.id,
      lastResetAt: null,
      lastResetBy: null,
    },
    create: {
      id: 'platform-setup',
      setupCompleted: true,
      setupVersion: '9.0.0',
      setupCompletedAt: new Date(),
      setupCompletedBy: recruiterAUser.id,
    },
  });

  const job = await prisma.job.upsert({
    where: { slug: JOB_SLUG },
    update: {
      recruiterId: recruiterAUser.id,
      organisationId: organisation.id,
      title: 'E2E Frontend Engineer',
      description: 'Used for messaging E2E verification.',
      skillsRequired: ['React', 'Next.js', 'TypeScript'],
      experienceMin: 3,
      experienceMax: 6,
      salaryMin: 900000,
      salaryMax: 1500000,
      location: 'Bengaluru',
      employmentType: 'FULL_TIME',
      status: 'OPEN',
      isPublic: true,
      visibility: 'EXTERNAL',
    },
    create: {
      recruiterId: recruiterAUser.id,
      organisationId: organisation.id,
      title: 'E2E Frontend Engineer',
      slug: JOB_SLUG,
      description: 'Used for messaging E2E verification.',
      skillsRequired: ['React', 'Next.js', 'TypeScript'],
      experienceMin: 3,
      experienceMax: 6,
      salaryMin: 900000,
      salaryMax: 1500000,
      location: 'Bengaluru',
      employmentType: 'FULL_TIME',
      status: 'OPEN',
      isPublic: true,
      visibility: 'EXTERNAL',
    },
  });

  const acceptedPairs = [
    [candidateAUser.id, recruiterAUser.id],
    [candidateAUser.id, candidateBUser.id],
  ];

  const createdConnections = [];
  for (const [requesterUserId, receiverUserId] of acceptedPairs) {
    const connection = await prisma.userConnection.create({
      data: {
        requesterUserId,
        receiverUserId,
        pairKey: buildPairKey(requesterUserId, receiverUserId),
        status: 'ACCEPTED',
        source: 'PROFILE',
        acceptedAt: new Date(),
      },
    });
    createdConnections.push(connection);
  }

  console.log(JSON.stringify({
    password: PASSWORD,
    candidateA: {
      email: USERS.candidateA.email,
      fullName: USERS.candidateA.fullName,
      userId: candidateAUser.id,
    },
    candidateB: {
      email: USERS.candidateB.email,
      fullName: USERS.candidateB.fullName,
      userId: candidateBUser.id,
    },
    recruiterA: {
      email: USERS.recruiterA.email,
      fullName: USERS.recruiterA.fullName,
      userId: recruiterAUser.id,
    },
    organisation: {
      id: organisation.id,
      slug: organisation.slug,
    },
    job: {
      id: job.id,
      slug: job.slug,
    },
    connections: createdConnections.map((connection) => ({
      id: connection.id,
      requesterUserId: connection.requesterUserId,
      receiverUserId: connection.receiverUserId,
    })),
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
