import crypto from 'crypto';
import { env } from '../../config/env.js';

// Reusable LinkedIn job-announcement composer. It reads ONLY fields that are
// already public on the candidate-facing job page: no salary, recruiter notes,
// hiring-manager/contact details, walk-in contacts, screening questions or
// candidate data are ever used.

export function generateTrackingRef() {
  // Opaque, URL-safe (hex => no characters LinkedIn treats specially).
  return crypto.randomBytes(8).toString('hex');
}

export function publicJobUrl(job, trackingRef = null) {
  const base = String(env.publicAppUrl || env.frontendUrl).replace(/\/$/, '');
  const url = `${base}/jobs/${job.slug}`;
  return trackingRef ? `${url}?li=${trackingRef}` : url;
}

const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0$|\[::1\]$)/i;

// A LinkedIn post must link to a page candidates can actually open. Returns a
// reason string when the URL is not publicly reachable (localhost/private/non-https).
export function getPublicUrlProblem(url) {
  if (env.linkedinAllowNonPublicUrl) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return 'The job link is not a valid URL.'; }
  const host = parsed.hostname;
  const privateHost = PRIVATE_HOST.test(host) || !host.includes('.');
  if (privateHost) return `The Careeriz public URL points to a local/private address (${host}). Set PUBLIC_APP_URL to the public https domain before sharing on LinkedIn.`;
  if (parsed.protocol !== 'https:') return 'The Careeriz public URL is not https. Set PUBLIC_APP_URL to the public https domain.';
  return null;
}

// A job may be announced only while it is genuinely open to candidates.
export function getJobShareIneligibility(job, now = new Date()) {
  if (!job) return 'Job not found.';
  if (job.status !== 'OPEN') return 'Only published (open) jobs can be shared.';
  if (job.isPublic === false) return 'The job is not public.';
  if (job.visibility === 'INTERNAL') return 'Internal-only jobs cannot be shared externally.';
  if (job.applicationOpensAt && new Date(job.applicationOpensAt) > now) return 'The job has not opened for applications yet.';
  const closes = job.applicationClosesAt || job.applicationDeadline;
  if (closes && new Date(closes) <= now) return 'The job has expired.';
  return null;
}

function locationText(job) {
  const names = Array.isArray(job.locations) && job.locations.length
    ? job.locations.map((l) => l?.name || l?.city).filter(Boolean)
    : [];
  const text = (names.length ? names.join(', ') : job.location) || '';
  return text && text !== 'Not specified' ? text : '';
}

const WORK_MODE = { ONSITE: 'On-site', HYBRID: 'Hybrid', REMOTE: 'Remote' };

function summarise(description, max = 180) {
  const plain = String(description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_`>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}…`;
}

// Wording differs per destination type so the same job is not posted verbatim
// from the recruiter and from the Careeriz owner (no reach claims are made).
const TEMPLATES = {
  RECRUITER: ({ title, company, where, summary, skills, url }) => [
    `We're hiring: ${title}${company ? ` at ${company}` : ''}${where ? ` (${where})` : ''}`,
    summary,
    skills ? `Key skills: ${skills}` : null,
    `View the role and apply on Careeriz: ${url}`,
  ],
  PLATFORM: ({ title, company, where, summary, skills, url }) => [
    `New opening on Careeriz: ${title}${company ? ` — ${company}` : ''}${where ? ` · ${where}` : ''}`,
    summary,
    skills ? `Looking for: ${skills}` : null,
    `Apply directly or create your Careeriz profile: ${url}`,
    '#Hiring #Jobs',
  ],
};

export function composeJobPost(job, { destinationType = 'RECRUITER', trackingRef = null, companyName = null } = {}) {
  const url = publicJobUrl(job, trackingRef);
  const mode = WORK_MODE[job.workplaceType];
  const where = [locationText(job), mode].filter(Boolean).join(' · ');
  const skills = (job.skillsRequired || []).slice(0, 5).join(', ');
  const lines = (TEMPLATES[destinationType] || TEMPLATES.RECRUITER)({
    title: job.title,
    company: companyName,
    where,
    summary: summarise(job.description),
    skills,
    url,
  }).filter(Boolean);
  const commentary = lines.join('\n\n').slice(0, 2900);
  return {
    commentary,
    url,
    title: job.title,
    cardDescription: summarise(job.description, 240) || 'View this role on Careeriz.',
  };
}
