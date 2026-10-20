import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

// Recruiters may post updates to their network, but not job openings: a post
// that reads as a vacancy / hiring announcement is only accepted when it points
// at one of the recruiter's own open jobs through its Careeriz link, so
// applications always go through Careeriz.

const HIRING_LANGUAGE = new RegExp([
  "we(?:'| a)re hiring",
  'now hiring',
  'hiring (?:for|alert|now|urgently)',
  'job openings?',
  'vacanc(?:y|ies)',
  'openings? (?:for|in|at)',
  'walk-?in',
  'apply (?:now|here|today|at|via|through|on)',
  'send (?:your |us )?(?:cv|resume|profile)',
  'urgent(?:ly)? (?:requirement|required|hiring)',
  'looking for (?:an? )?(?:[\\w+#./-]+\\s+){0,4}(?:developer|engineer|manager|analyst|executive|designer|consultant|recruiter|architect|lead|specialist|associate|intern)',
  'join our team',
  'career opportunit(?:y|ies)',
  'position (?:available|open)',
  'job description',
  'required skills',
].join('|'), 'i');

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_PATTERN = /(?:\+?\d[\s-]?){10,}/;

function policyError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 422;
  return error;
}

function careerizHosts() {
  const hosts = new Set(['careeriz.com', 'www.careeriz.com']);
  try {
    hosts.add(new URL(env.frontendUrl).host.toLowerCase());
  } catch {
    // FRONTEND_URL is validated at boot; ignore here.
  }
  return hosts;
}

export function isRecruiterRole(role) {
  return role === 'RECRUITER' || role === 'RECRUITER_ADMIN';
}

// Splits the http(s) links in a post into Careeriz job slugs and "other" links.
export function extractPostLinks(content) {
  const hosts = careerizHosts();
  const urls = String(content || '').match(URL_PATTERN) || [];
  const jobSlugs = [];
  let hasOtherLink = false;
  urls.forEach((raw) => {
    try {
      const url = new URL(raw.replace(/[.,;:!?]+$/, ''));
      const match = hosts.has(url.host.toLowerCase()) ? url.pathname.match(/^\/jobs\/([^/]+)\/?$/) : null;
      if (match) jobSlugs.push(decodeURIComponent(match[1]));
      else hasOtherLink = true;
    } catch {
      hasOtherLink = true;
    }
  });
  return { jobSlugs, hasOtherLink };
}

// Open, public, non-archived jobs (any company) addressed by these slugs.
export const OPEN_PUBLIC_JOB_WHERE = { status: 'OPEN', isPublic: true, archivedAt: null };

export async function assertRecruiterPostAllowed(user, content) {
  const { jobSlugs, hasOtherLink } = extractPostLinks(content);

  // Every Careeriz job link must be an open job of the recruiter's own company.
  if (jobSlugs.length) {
    const organisationId = user.activeMembership?.organisationId || user.recruiterProfile?.organisationId || null;
    const jobs = organisationId
      ? await prisma.job.findMany({
        where: { slug: { in: jobSlugs }, organisationId, ...OPEN_PUBLIC_JOB_WHERE },
        select: { slug: true },
      })
      : [];
    const valid = new Set(jobs.map((job) => job.slug));
    if (jobSlugs.some((slug) => !valid.has(slug))) {
      throw policyError('JOB_LINK_NOT_ALLOWED', 'You can only share Careeriz links to open jobs from your own company.');
    }
  }

  if (HIRING_LANGUAGE.test(content)) {
    if (!jobSlugs.length) {
      throw policyError(
        'HIRING_POST_NOT_ALLOWED',
        'Job openings cannot be posted as text. Share your job by attaching its Careeriz job link instead.',
      );
    }
    // With a Careeriz link, applications must go through Careeriz - no side channels.
    if (hasOtherLink || EMAIL_PATTERN.test(content) || PHONE_PATTERN.test(content)) {
      throw policyError(
        'HIRING_POST_CONTACT_NOT_ALLOWED',
        'Applications for a job must go through its Careeriz link. Remove other links, emails or phone numbers from this post.',
      );
    }
  }
}
