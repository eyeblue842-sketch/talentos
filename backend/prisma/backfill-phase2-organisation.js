import slugify from 'slugify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shouldApply = process.argv.includes('--apply');

async function buildUniqueSlug(baseValue) {
  const base = slugify(baseValue, { lower: true, strict: true }) || `organisation-${Date.now()}`;
  let slug = base;
  let counter = 1;

  while (await prisma.organisation.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }

  return slug;
}

async function main() {
  const recruiterProfiles = await prisma.recruiterProfile.findMany({
    where: { organisationId: null },
    include: { user: true },
    orderBy: { userId: 'asc' },
  });

  const plan = recruiterProfiles.map((profile) => {
    const inferredName = profile.companyName || profile.companyEmailDomain.split('.')[0];
    return {
      recruiterProfileId: profile.id,
      userId: profile.userId,
      email: profile.user.email,
      organisationName: inferredName,
    };
  });

  if (!shouldApply) {
    console.log(JSON.stringify({
      apply: false,
      pendingRecruiterProfiles: plan.length,
      plan,
      instruction: 'Re-run with --apply after reviewing the plan.',
    }, null, 2));
    return;
  }

  for (const item of plan) {
    const slug = await buildUniqueSlug(item.organisationName);
    const organisation = await prisma.organisation.create({
      data: {
        name: item.organisationName,
        slug,
      },
    });

    await prisma.organisationMembership.create({
      data: {
        organisationId: organisation.id,
        userId: item.userId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const recruiterProfile = await prisma.recruiterProfile.update({
      where: { id: item.recruiterProfileId },
      data: { organisationId: organisation.id },
    });

    const recruiterJobs = await prisma.job.findMany({
      where: { recruiterId: item.userId, organisationId: null },
      select: { id: true },
    });

    if (recruiterJobs.length) {
      const jobIds = recruiterJobs.map((job) => job.id);
      await prisma.job.updateMany({
        where: { id: { in: jobIds } },
        data: { organisationId: organisation.id },
      });
      await prisma.application.updateMany({
        where: { jobId: { in: jobIds }, organisationId: null },
        data: { organisationId: organisation.id },
      });
      await prisma.atsNote.updateMany({
        where: { application: { jobId: { in: jobIds } }, organisationId: null },
        data: { organisationId: organisation.id },
      });
      await prisma.applicationActivity.updateMany({
        where: { application: { jobId: { in: jobIds } }, organisationId: null },
        data: { organisationId: organisation.id },
      });
    }

    await prisma.savedCandidate.updateMany({
      where: { recruiterId: recruiterProfile.id, organisationId: null },
      data: { organisationId: organisation.id },
    });
  }

  console.log(JSON.stringify({
    apply: true,
    migratedRecruiterProfiles: plan.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
