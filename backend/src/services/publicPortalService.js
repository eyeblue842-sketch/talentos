import { prisma } from '../config/db.js';
import { serializePublicJob, serializePublicOrganisation } from '../serializers/index.js';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const MAX_RELEVANCE_CANDIDATES = 250;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function buildPaginationMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function clampPage(total, requestedPage, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, requestedPage), pageCount);
}

export function buildPublicJobWhere(filters = {}) {
  const now = new Date();
  const and = [
    { status: 'OPEN' },
    { archivedAt: null },
    { isPublic: true },
    { visibility: { in: ['EXTERNAL', 'BOTH'] } },
    {
      OR: [
        { applicationOpensAt: null },
        { applicationOpensAt: { lte: now } },
      ],
    },
    {
      OR: [
        { applicationClosesAt: null },
        { applicationClosesAt: { gte: now } },
      ],
    },
    {
      OR: [
        { applicationDeadline: null },
        { applicationDeadline: { gte: now } },
      ],
    },
    {
      organisation: {
        status: 'ACTIVE',
        careersEnabled: true,
      },
    },
  ];

  if (filters.keyword) {
    and.push({
      OR: [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
        { skillsRequired: { hasSome: filters.skills?.length ? filters.skills : [filters.keyword] } },
      ],
    });
  }

  if (filters.title) {
    and.push({ title: { contains: filters.title, mode: 'insensitive' } });
  }

  if (filters.skills?.length) {
    and.push({ skillsRequired: { hasSome: filters.skills } });
  }

  if (filters.location) {
    and.push({ location: { contains: filters.location, mode: 'insensitive' } });
  }

  if (filters.organisation) {
    and.push({
      organisation: {
        name: { contains: filters.organisation, mode: 'insensitive' },
      },
    });
  }

  if (filters.organisationSlug) {
    and.push({
      organisation: {
        slug: filters.organisationSlug,
      },
    });
  }

  if (filters.employmentType?.length) {
    and.push({ employmentType: { in: filters.employmentType } });
  }

  if (filters.workplaceType?.length) {
    and.push({ workplaceType: { in: filters.workplaceType } });
  }

  if (typeof filters.minExperience === 'number') {
    and.push({ experienceMax: { gte: filters.minExperience } });
  }

  if (typeof filters.maxExperience === 'number') {
    and.push({ experienceMin: { lte: filters.maxExperience } });
  }

  if (typeof filters.salaryMin === 'number') {
    and.push({
      OR: [
        { publicSalaryEnabled: false },
        { salaryMax: { gte: filters.salaryMin } },
      ],
    });
  }

  if (typeof filters.salaryMax === 'number') {
    and.push({
      OR: [
        { publicSalaryEnabled: false },
        { salaryMin: { lte: filters.salaryMax } },
      ],
    });
  }

  if (filters.fresherFriendly) {
    and.push({ experienceMin: { lte: 0 } });
  }

  if (typeof filters.postedWithinDays === 'number') {
    const date = new Date();
    date.setDate(date.getDate() - filters.postedWithinDays);
    and.push({ createdAt: { gte: date } });
  }

  return { AND: and };
}

function buildPublicJobOrder(sort = 'relevance') {
  if (sort === 'oldest') return [{ createdAt: 'asc' }, { id: 'asc' }];
  if (sort === 'closing_date') return [{ applicationClosesAt: 'asc' }, { applicationDeadline: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];
  if (sort === 'salary_high') return [{ salaryMax: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  if (sort === 'relevance') return [{ featuredInPortal: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  return [{ createdAt: 'desc' }, { id: 'asc' }];
}

function scorePublicJob(job, filters = {}) {
  let score = 0;
  const keyword = normalize(filters.keyword);
  const title = normalize(filters.title);
  const location = normalize(filters.location);
  const organisation = normalize(filters.organisation);
  const skills = (filters.skills || []).map(normalize);
  const jobTitle = normalize(job.title);
  const jobDescription = normalize(job.description);
  const jobLocation = normalize(job.location);
  const jobOrganisation = normalize(job.organisation?.name);
  const jobSkills = (job.skillsRequired || []).map(normalize);

  if (keyword) {
    if (jobTitle.includes(keyword)) score += 40;
    if (jobDescription.includes(keyword)) score += 10;
    if (jobSkills.some((skill) => skill.includes(keyword))) score += 20;
  }

  if (title && jobTitle.includes(title)) score += 30;
  if (location && jobLocation.includes(location)) score += 15;
  if (organisation && jobOrganisation.includes(organisation)) score += 12;

  const skillMatches = skills.filter((skill) => jobSkills.includes(skill)).length;
  score += skillMatches * 10;

  if (job.featuredInPortal) score += 3;
  return score;
}

function paginateRows(rows, page, pageSize) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

async function loadSavedJobIds(candidateId, jobIds) {
  if (!candidateId || !jobIds.length) return new Set();
  const rows = await prisma.savedJob.findMany({
    where: {
      candidateId,
      jobId: { in: jobIds },
    },
    select: { jobId: true },
  });

  return new Set(rows.map((row) => row.jobId).filter(Boolean));
}

export async function getPublicPortalHome(candidateId = null) {
  const baseWhere = buildPublicJobWhere();
  const [latestJobs, featuredJobs, categories, locations, workplaceTypes] = await Promise.all([
    prisma.job.findMany({
      where: baseWhere,
      include: { organisation: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 8,
    }),
    prisma.job.findMany({
      where: { ...baseWhere, AND: [...baseWhere.AND, { featuredInPortal: true }] },
      include: { organisation: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 6,
    }),
    prisma.job.findMany({
      where: baseWhere,
      select: { skillsRequired: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job.findMany({
      where: baseWhere,
      select: { location: true },
      distinct: ['location'],
      take: 8,
      orderBy: { location: 'asc' },
    }),
    prisma.job.findMany({
      where: baseWhere,
      select: { workplaceType: true },
      distinct: ['workplaceType'],
      take: 3,
    }),
  ]);

  const savedIds = await loadSavedJobIds(candidateId, [
    ...latestJobs.map((job) => job.id),
    ...featuredJobs.map((job) => job.id),
  ]);

  const categoryCounts = new Map();
  for (const row of categories) {
    for (const skill of row.skillsRequired.slice(0, 5)) {
      categoryCounts.set(skill, (categoryCounts.get(skill) || 0) + 1);
    }
  }

  return {
    latestJobs: latestJobs.map((job) => serializePublicJob(job, { saved: savedIds.has(job.id) })),
    featuredJobs: featuredJobs.map((job) => serializePublicJob(job, { saved: savedIds.has(job.id) })),
    categories: [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([label, count]) => ({ label, count })),
    locations: locations.map((row) => row.location).filter(Boolean),
    workplaceTypes: workplaceTypes.map((row) => row.workplaceType).filter(Boolean),
  };
}

export async function searchPublicJobs(filters = {}, candidateId = null) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const where = buildPublicJobWhere(filters);
  const total = await prisma.job.count({ where });

  if (filters.sort === 'relevance') {
    const boundedTotal = Math.min(total, MAX_RELEVANCE_CANDIDATES);
    const page = clampPage(boundedTotal, requestedPage, pageSize);
    const candidateWindowSize = Math.max(page * pageSize * 4, pageSize * 4);
    const take = Math.min(MAX_RELEVANCE_CANDIDATES, candidateWindowSize);
    const rawJobs = await prisma.job.findMany({
      where,
      include: { organisation: true },
      orderBy: buildPublicJobOrder('relevance'),
      take,
    });

    const sortedJobs = rawJobs
      .map((job) => ({ job, score: scorePublicJob(job, filters) }))
      .sort((a, b) => b.score - a.score || Number(b.job.featuredInPortal) - Number(a.job.featuredInPortal) || b.job.createdAt - a.job.createdAt || a.job.id.localeCompare(b.job.id))
      .map((item) => item.job);

    const pageJobs = paginateRows(sortedJobs, page, pageSize);
    const savedIds = await loadSavedJobIds(candidateId, pageJobs.map((job) => job.id));

    return {
      items: pageJobs.map((job) => serializePublicJob(job, { saved: savedIds.has(job.id) })),
      meta: buildPaginationMeta(boundedTotal, page, pageSize),
    };
  }

  const page = clampPage(total, requestedPage, pageSize);
  const rawJobs = await prisma.job.findMany({
    where,
    include: { organisation: true },
    orderBy: buildPublicJobOrder(filters.sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const pageJobs = rawJobs;
  const savedIds = await loadSavedJobIds(candidateId, pageJobs.map((job) => job.id));

  return {
    items: pageJobs.map((job) => serializePublicJob(job, { saved: savedIds.has(job.id) })),
    meta: buildPaginationMeta(total, page, pageSize),
  };
}

export async function getPublicJobDetail(slug, candidateId = null) {
  const job = await prisma.job.findFirst({
    where: {
      slug,
      ...buildPublicJobWhere(),
    },
    include: { organisation: true },
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  const [similarRows, savedIds] = await Promise.all([
    prisma.job.findMany({
      where: {
        ...buildPublicJobWhere(),
        id: { not: job.id },
      },
      include: { organisation: true },
      take: 30,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    loadSavedJobIds(candidateId, [job.id]),
  ]);

  const titleTokens = normalize(job.title).split(/\s+/).filter((token) => token.length > 2);
  const similarJobs = similarRows
    .map((row) => {
      let score = 0;
      const rowSkills = (row.skillsRequired || []).map(normalize);
      const skillMatches = (job.skillsRequired || []).map(normalize).filter((skill) => rowSkills.includes(skill)).length;
      if (skillMatches) score += skillMatches * 8;
      if (normalize(row.location) === normalize(job.location)) score += 6;
      if (row.employmentType === job.employmentType) score += 4;
      if (row.organisationId === job.organisationId) score += 5;
      if (titleTokens.some((token) => normalize(row.title).includes(token))) score += 5;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.row.createdAt - a.row.createdAt || a.row.id.localeCompare(b.row.id))
    .slice(0, 6)
    .map((item) => serializePublicJob(item.row));

  return {
    job: serializePublicJob(job, { saved: savedIds.has(job.id) }),
    similarJobs,
  };
}

export async function getPublicOrganisationProfile(slug, filters = {}, candidateId = null) {
  const organisation = await prisma.organisation.findFirst({
    where: {
      slug,
      status: 'ACTIVE',
      careersEnabled: true,
    },
  });

  if (!organisation) {
    const error = new Error('Organisation not found.');
    error.statusCode = 404;
    throw error;
  }

  const scopedFilters = { ...filters, organisationSlug: slug };
  const jobs = await searchPublicJobs(scopedFilters, candidateId);

  return {
    organisation: serializePublicOrganisation(organisation),
    jobs,
  };
}

export async function listPublicOrganisations() {
  const organisations = await prisma.organisation.findMany({
    where: {
      status: 'ACTIVE',
      careersEnabled: true,
      jobs: {
        some: {
          status: 'OPEN',
          archivedAt: null,
          isPublic: true,
          OR: [
            { applicationDeadline: null },
            { applicationDeadline: { gte: new Date() } },
          ],
        },
      },
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { slug: 'asc' }],
    take: 500,
  });

  return organisations.map((organisation) => ({
    slug: organisation.slug,
    updatedAt: organisation.updatedAt.toISOString(),
  }));
}
