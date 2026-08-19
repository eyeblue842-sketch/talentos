import { prisma } from '../config/db.js';
import { serializePublicJob } from '../serializers/index.js';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function scoreSkillFit(candidateSkills = [], jobSkills = []) {
  if (!candidateSkills.length || !jobSkills.length) return 0;
  const candidateSet = new Set(candidateSkills.map(normalize));
  const matched = jobSkills.filter((skill) => candidateSet.has(normalize(skill))).length;
  return Math.round((matched / jobSkills.length) * 60);
}

function scoreLocationFit(preferredLocations = [], jobLocation = '') {
  if (!preferredLocations.length || !jobLocation) return 0;
  const normalizedJobLocation = normalize(jobLocation);
  const normalizedPreferred = preferredLocations.map(normalize);
  if (normalizedPreferred.includes(normalizedJobLocation)) return 25;
  if (normalizedPreferred.includes('remote') && normalizedJobLocation.includes('remote')) return 25;
  return 0;
}

function scoreCtcFit(expectedCtc = null, salaryMin = null, salaryMax = null) {
  if (!expectedCtc || (!salaryMin && !salaryMax)) return 0;
  const expectedValue = Number(expectedCtc);
  if (salaryMin && salaryMax && expectedValue >= salaryMin && expectedValue <= salaryMax) return 15;
  if (salaryMax && expectedValue <= salaryMax) return 10;
  if (salaryMin && expectedValue >= salaryMin) return 8;
  return 0;
}

function buildReasons(job, profile, score) {
  const reasons = [];
  if (score.skillScore > 0) reasons.push('Matched core skills from candidate profile');
  if (score.locationScore > 0) reasons.push('Preferred location fits this role');
  if (score.ctcScore > 0) reasons.push('Salary band aligns with expected CTC');
  if (!reasons.length) reasons.push('Basic relevance based on available profile signals');
  return reasons;
}

export async function getCandidateRecommendedJobs(candidateId) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
  });

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const jobs = await prisma.job.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const preferredLocations = profile.preferredLocations || [];
  const expectedCtc = profile.expectedCtcLpa || null;

  const recommendedJobs = jobs
    .map((job) => {
      const score = {
        skillScore: scoreSkillFit(profile.skills || [], job.skillsRequired || []),
        locationScore: scoreLocationFit(preferredLocations, job.location),
        ctcScore: scoreCtcFit(expectedCtc, job.salaryMin, job.salaryMax),
      };
      const totalScore = Math.min(score.skillScore + score.locationScore + score.ctcScore, 100);

      return {
        // Candidate-facing: must go through the public serializer so a hidden
        // salary never leaks here, even though scoring above uses the real
        // job.salaryMin/salaryMax internally.
        ...serializePublicJob(job),
        recommendationScore: totalScore,
        matchReasons: buildReasons(job, profile, score),
      };
    })
    .filter((job) => job.recommendationScore > 0)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 6);

  return {
    candidateProfile: {
      skills: profile.skills || [],
      preferredLocations,
      expectedCtcLpa: expectedCtc,
    },
    recommendedJobs,
  };
}
