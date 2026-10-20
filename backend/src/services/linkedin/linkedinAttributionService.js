import { prisma } from '../../config/db.js';

// First-party candidate-acquisition attribution for LinkedIn posts.
//
// Privacy model: the only identifier on a shared link is an opaque random
// `li` reference (LinkedInPost.trackingRef) - no name, e-mail or user id. The
// browser keeps it in sessionStorage (no cookie) and reports funnel events to
// us. Anonymous events are de-duplicated with a random per-tab visitor id;
// outcome events (registration/upload/profile/application) require a signed-in
// user. Nothing here reads LinkedIn-side metrics: impressions, reach,
// LinkedIn-reported clicks and connection growth are NOT available from the
// permitted API surface and are never reported.

const ANONYMOUS_EVENTS = new Set(['CLICK', 'REGISTRATION_START']);
export const ATTRIBUTION_EVENT_TYPES = ['CLICK', 'REGISTRATION_START', 'REGISTRATION_COMPLETE', 'RESUME_UPLOAD', 'PROFILE_COMPLETE', 'APPLICATION'];
const REF_PATTERN = /^[a-f0-9]{16}$/;
const VISITOR_PATTERN = /^[a-f0-9]{16,32}$/;

function reject(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const REGISTRATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const PROFILE_COMPLETE_THRESHOLD = 80;

async function hasServerProof(eventType, userId, post) {
  const since = post.queuedAt ? new Date(post.queuedAt) : new Date(0);
  switch (eventType) {
    case 'REGISTRATION_COMPLETE': {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
      return Boolean(user && new Date(user.createdAt) >= since && Date.now() - new Date(user.createdAt).getTime() <= REGISTRATION_WINDOW_MS);
    }
    case 'RESUME_UPLOAD':
      return Boolean(await prisma.resumeAsset.findFirst({ where: { ownerUserId: userId, kind: 'RESUME', createdAt: { gte: since } }, select: { id: true } }));
    case 'PROFILE_COMPLETE': {
      const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { profileCompletenessScore: true } });
      return Boolean(profile && (profile.profileCompletenessScore || 0) >= PROFILE_COMPLETE_THRESHOLD);
    }
    case 'APPLICATION':
      return Boolean(await prisma.application.findFirst({ where: { jobId: post.jobId, candidate: { userId }, appliedAt: { gte: since } }, select: { id: true } }));
    default:
      return false;
  }
}

export async function recordAttributionEvent({ ref, eventType, userId = null, visitorId = null }) {
  if (!REF_PATTERN.test(String(ref || ''))) throw reject('Invalid reference.');
  if (!ATTRIBUTION_EVENT_TYPES.includes(eventType)) throw reject('Unsupported event type.');
  if (!ANONYMOUS_EVENTS.has(eventType) && !userId) throw reject('Sign-in required for this event.', 401);
  if (!userId && !VISITOR_PATTERN.test(String(visitorId || ''))) throw reject('A visitor id is required for anonymous events.');

  const post = await prisma.linkedInPost.findUnique({ where: { trackingRef: ref }, select: { id: true, jobId: true, queuedAt: true } });
  if (!post) return { recorded: false };

  // Outcome events are only counted when the database proves them, so a
  // browser cannot inflate the funnel and a returning user who merely signs in
  // is not mistaken for a new registration.
  if (!ANONYMOUS_EVENTS.has(eventType) && !(await hasServerProof(eventType, userId, post))) {
    return { recorded: false };
  }

  try {
    await prisma.linkedInTrackingEvent.create({
      data: { postId: post.id, jobId: post.jobId, eventType, subjectKey: userId ? `u:${userId}` : `v:${visitorId}` },
    });
    return { recorded: true };
  } catch (error) {
    if (error?.code === 'P2002') return { recorded: false, duplicate: true };
    throw error;
  }
}

function emptyCounts() {
  return Object.fromEntries(ATTRIBUTION_EVENT_TYPES.map((type) => [type, 0]));
}

function rate(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export async function getAttributionReport({ since = null } = {}) {
  const posts = await prisma.linkedInPost.findMany({
    where: { status: 'PUBLISHED', ...(since ? { publishedAt: { gte: since } } : {}) },
    select: { id: true, jobId: true, destinationType: true, destinationId: true, linkedinPostId: true, postUrl: true, publishedAt: true, job: { select: { title: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  });
  const postIds = posts.map((post) => post.id);
  const grouped = postIds.length
    ? await prisma.linkedInTrackingEvent.groupBy({ by: ['postId', 'eventType'], where: { postId: { in: postIds } }, _count: { _all: true } })
    : [];

  const perPost = new Map(posts.map((post) => [post.id, emptyCounts()]));
  for (const row of grouped) perPost.get(row.postId)[row.eventType] = row._count._all;

  const withRates = (counts) => ({
    ...counts,
    clickToRegistrationRate: rate(counts.REGISTRATION_COMPLETE, counts.CLICK),
    clickToApplicationRate: rate(counts.APPLICATION, counts.CLICK),
  });

  const destinations = new Map();
  const postRows = posts.map((post) => {
    const counts = perPost.get(post.id);
    const key = `${post.destinationType}:${post.destinationId}`;
    const total = destinations.get(key) || { destinationType: post.destinationType, destinationId: post.destinationId, posts: 0, counts: emptyCounts() };
    total.posts += 1;
    for (const type of ATTRIBUTION_EVENT_TYPES) total.counts[type] += counts[type];
    destinations.set(key, total);
    return {
      postId: post.id,
      jobId: post.jobId,
      jobTitle: post.job?.title || null,
      destinationType: post.destinationType,
      destinationId: post.destinationId,
      linkedinPostId: post.linkedinPostId,
      postUrl: post.postUrl,
      publishedAt: post.publishedAt,
      ...withRates(counts),
    };
  });

  return {
    basis: 'MEASURED_FIRST_PARTY',
    note: 'Counts are first-party Careeriz events attributed via the link reference. Impressions, reach, LinkedIn-side clicks and connection growth are not available from the permitted LinkedIn API and are not estimated.',
    unavailable: ['impressions', 'reach', 'linkedinReportedClicks', 'connectionGrowth'],
    byDestination: [...destinations.values()].map((entry) => ({ ...entry, ...withRates(entry.counts) })),
    byPost: postRows,
  };
}
