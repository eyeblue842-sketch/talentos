import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

async function main() {
  await prisma.applicationActivity.deleteMany();
  await prisma.atsNote.deleteMany();
  await prisma.application.deleteMany();
  await prisma.savedCandidate.deleteMany();
  await prisma.resumeBuilder.deleteMany();
  await prisma.job.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.recruiterProfile.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password@123', 10);

  const recruiter = await prisma.user.create({
    data: {
      email: 'recruiter@careeriz.demo',
      passwordHash,
      role: 'RECRUITER',
      recruiterProfile: {
        create: {
          companyEmailDomain: 'careeriz.app',
          companyName: 'TalentOS Labs',
          aboutCompany: 'TalentOS Labs builds recruitment technology products for modern hiring teams.',
          industryDomain: 'Information Technology',
          companyType: 'MNC',
          headquartersLocation: 'Bengaluru',
          startedYear: 2019,
          employeeCount: 120,
          branchCount: 3,
          officeLocations: ['Bengaluru', 'Hyderabad', 'Pune'],
          annualTurnover: 'INR 35 Cr',
          designation: 'Hiring Manager',
          workingSince: 2022,
          companySize: '51-200',
          website: 'https://careeriz.app',
          profileCompleted: true,
        },
      },
    },
    include: { recruiterProfile: true },
  });

  const candidate = await prisma.user.create({
    data: {
      email: 'candidate@careeriz.demo',
      passwordHash,
      role: 'CANDIDATE',
      candidateProfile: {
        create: {
          fullName: 'Aarav Sharma',
          headline: 'Full Stack Developer',
          location: 'Bengaluru',
          preferredLocations: ['Bengaluru', 'Remote', 'Hyderabad'],
          totalExperience: 3,
          currentCtcLpa: 10,
          expectedCtcLpa: 14,
          availability: 'TWO_WEEKS',
          skills: ['React', 'Next.js', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
          summary: 'Product-minded engineer with SaaS hiring platform experience.',
          sharedResumeSlug: slugify('Aarav Sharma Resume', { lower: true, strict: true }),
        },
      },
    },
    include: { candidateProfile: true },
  });

  const job = await prisma.job.create({
    data: {
      recruiterId: recruiter.id,
      title: 'Frontend Engineer',
      slug: slugify('Frontend Engineer TalentOS', { lower: true, strict: true }),
      description: 'Build polished recruiter workflows and candidate experiences.',
      skillsRequired: ['React', 'Next.js', 'Tailwind CSS'],
      experienceMin: 2,
      experienceMax: 5,
      salaryMin: 800000,
      salaryMax: 1400000,
      location: 'Bengaluru',
      employmentType: 'FULL_TIME',
      status: 'OPEN',
    },
  });

  await prisma.resumeBuilder.create({
    data: {
      candidateId: candidate.candidateProfile.id,
      template: 'classic',
      personal: { email: candidate.email, phone: '+91 90000 00000', location: 'Bengaluru' },
      education: [{ school: 'VTU', degree: 'B.E. CSE', year: '2022' }],
      experience: [{ company: 'SaaSly', role: 'Software Engineer', summary: 'Built job search workflows.' }],
      skills: ['React', 'Next.js', 'Node.js'],
      projects: [{ name: 'Hiring Hub', summary: 'Internal ATS dashboard.' }],
      completedScore: 100,
    },
  });

  await prisma.application.create({
    data: {
      jobId: job.id,
      candidateId: candidate.candidateProfile.id,
      currentStage: 'SHORTLISTED',
      statusLabel: 'Shortlisted',
      matchScore: 100,
      activities: {
        createMany: {
          data: [
            { message: 'Application submitted.' },
            { message: 'Moved to Shortlisted.' },
          ],
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
