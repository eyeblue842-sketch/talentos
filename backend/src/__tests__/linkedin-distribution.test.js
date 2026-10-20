import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// In-memory prisma + stubbed global fetch: exercises the real service code
// (queueing, idempotency, claims, error classification, platform controls)
// without a database or any call to LinkedIn.

let prisma;
let env;
let dist;
let platform;
let attribution;
let composer;
let client;
let platformRouter;
let isPlatformSuperAdmin;
let encryptMeetingSecret;

let db;
let fetchCalls;
let fetchImpl;
const realFetch = globalThis.fetch;
let seq = 0;

const clone = (v) => (v == null ? v : structuredClone(v));
const FUTURE = () => new Date(Date.now() + 30 * 24 * 3600 * 1000);

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((w) => matches(row, w));
    if (key === 'AND') return cond.every((w) => matches(row, w));
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(value);
      if ('not' in cond) return value !== cond.not;
      if ('lt' in cond) return value != null && new Date(value) < new Date(cond.lt);
      if ('lte' in cond) return value != null && new Date(value) <= new Date(cond.lte);
      if ('gt' in cond) return value != null && new Date(value) > new Date(cond.gt);
      if ('gte' in cond) return value != null && new Date(value) >= new Date(cond.gte);
      if ('startsWith' in cond) return String(value || '').startsWith(cond.startsWith);
      if ('contains' in cond) return String(value || '').toLowerCase().includes(String(cond.contains).toLowerCase());
      return Object.entries(cond).every(([k, v]) => matches(value || {}, { [k]: v })); // nested relation filter
    }
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    return value === cond;
  });
}

function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in v) row[k] = (row[k] || 0) + v.increment;
    else row[k] = v;
  }
  row.updatedAt = new Date();
  return row;
}

function table(name, { uniques = [] } = {}) {
  const rows = db[name];
  const compoundKey = (where) => Object.values(where).find((v) => v && typeof v === 'object' && !(v instanceof Date));
  return {
    findUnique: async ({ where }) => {
      const compound = compoundKey(where);
      const flat = compound && Object.keys(where).length === 1 ? compound : where;
      return clone(rows.find((r) => matches(r, flat)) || null);
    },
    findFirst: async ({ where }) => clone(rows.find((r) => matches(r, where)) || null),
    findMany: async ({ where, take } = {}) => rows.filter((r) => matches(r, where)).slice(0, take || 1000).map(clone),
    count: async ({ where } = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }) => {
      for (const keys of uniques) {
        if (rows.some((r) => keys.every((k) => r[k] === data[k]))) throw Object.assign(new Error('Unique'), { code: 'P2002' });
      }
      const row = { id: `${name}-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...clone(data) };
      rows.push(row);
      return clone(row);
    },
    update: async ({ where, data }) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('not found');
      return clone(applyData(row, clone(data)));
    },
    updateMany: async ({ where, data }) => {
      const hits = rows.filter((r) => matches(r, where));
      hits.forEach((r) => applyData(r, clone(data)));
      return { count: hits.length };
    },
    deleteMany: async ({ where }) => {
      const keep = rows.filter((r) => !matches(r, where));
      const count = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count };
    },
    upsert: async ({ where, create, update }) => {
      const row = rows.find((r) => matches(r, where));
      if (row) return clone(applyData(row, clone(update)));
      const created = { createdAt: new Date(), updatedAt: new Date(), ...clone(create) };
      rows.push(created);
      return clone(created);
    },
    groupBy: async () => [],
  };
}

function installFakePrisma() {
  db = { job: [], socialConnection: [], linkedInDestination: [], linkedInPlatformSettings: [], linkedInPost: [], auditLog: [], backgroundTask: [], linkedInTrackingEvent: [], application: [], user: [], resumeAsset: [], candidateProfile: [] };
  prisma.job = {
    ...table('job'),
    findUnique: async ({ where }) => {
      const job = db.job.find((j) => j.id === where.id);
      return job ? clone({ ...job, organisation: { name: 'Acme Hiring' } }) : null;
    },
  };
  prisma.socialConnection = {
    ...table('socialConnection'),
    findUnique: async ({ where }) => {
      const key = where.organisationId_provider;
      return clone(db.socialConnection.find((c) => (key ? c.organisationId === key.organisationId && c.provider === key.provider : c.id === where.id)) || null);
    },
  };
  prisma.linkedInDestination = { ...table('linkedInDestination', { uniques: [['memberUrn']] }) };
  prisma.linkedInDestination.findUnique = async ({ where }) => clone(db.linkedInDestination.find((d) => (where.id ? d.id === where.id : d.memberUrn === where.memberUrn)) || null);
  prisma.linkedInPlatformSettings = {
    ...table('linkedInPlatformSettings'),
    findUnique: async () => clone(db.linkedInPlatformSettings[0] || null),
    upsert: async ({ create, update }) => {
      if (db.linkedInPlatformSettings[0]) applyData(db.linkedInPlatformSettings[0], update);
      else db.linkedInPlatformSettings.push({ ...create });
      return clone(db.linkedInPlatformSettings[0]);
    },
  };
  prisma.linkedInPost = { ...table('linkedInPost', { uniques: [['jobId', 'destinationType', 'destinationId']] }) };
  prisma.linkedInPost.findUnique = async ({ where }) => {
    const k = where.jobId_destinationType_destinationId;
    return clone(db.linkedInPost.find((p) => (k ? p.jobId === k.jobId && p.destinationType === k.destinationType && p.destinationId === k.destinationId : p.id === where.id || p.trackingRef === where.trackingRef)) || null);
  };
  prisma.auditLog = { create: async ({ data }) => { db.auditLog.push({ id: `a${++seq}`, createdAt: new Date(), ...clone(data) }); return { ...data, id: `a${seq}`, createdAt: new Date() }; } };
  prisma.backgroundTask = {
    create: async ({ data }) => {
      if (db.backgroundTask.some((t) => t.idempotencyKey === data.idempotencyKey)) throw Object.assign(new Error('Unique'), { code: 'P2002' });
      const row = { id: `task-${++seq}`, ...clone(data) };
      db.backgroundTask.push(row);
      return clone(row);
    },
    findUnique: async ({ where }) => clone(db.backgroundTask.find((t) => t.idempotencyKey === where.idempotencyKey) || null),
  };
  prisma.linkedInTrackingEvent = {
    ...table('linkedInTrackingEvent', { uniques: [['postId', 'eventType', 'subjectKey']] }),
    groupBy: async () => {
      const map = new Map();
      for (const e of db.linkedInTrackingEvent) {
        const key = `${e.postId}|${e.eventType}`;
        map.set(key, { postId: e.postId, eventType: e.eventType, _count: { _all: (map.get(key)?._count._all || 0) + 1 } });
      }
      return [...map.values()];
    },
  };
  prisma.application = table('application');
  prisma.user = table('user');
  prisma.resumeAsset = table('resumeAsset');
  prisma.candidateProfile = table('candidateProfile');
  prisma.$transaction = async (ops) => Promise.all(ops);
}

function seedJob(overrides = {}) {
  const job = {
    id: `job-${++seq}`, organisationId: 'org-1', slug: 'senior-engineer', title: 'Senior Engineer', description: 'Build great things. '.repeat(20),
    skillsRequired: ['Node.js', 'PostgreSQL'], status: 'OPEN', isPublic: true, visibility: 'EXTERNAL', location: 'Pune', workplaceType: 'HYBRID',
    salaryMin: 999999, salaryMax: 1999999, recruiterNotes: 'SECRET-NOTE', shareOnLinkedIn: false, excludeFromPlatformLinkedIn: false,
    applicationClosesAt: null, applicationOpensAt: null, activatedAt: new Date(), ...overrides,
  };
  db.job.push(job);
  return job;
}

function seedConnection(overrides = {}) {
  const row = {
    id: 'conn-1', organisationId: 'org-1', provider: 'LINKEDIN', status: 'CONNECTED', connectedAccountId: 'urn:li:person:rec1',
    encryptedAccessToken: encryptMeetingSecret('recruiter-access-token'), accessTokenExpiresAt: FUTURE(), scopes: ['openid', 'profile', 'w_member_social'],
    metadata: { memberUrn: 'urn:li:person:rec1' }, ...overrides,
  };
  db.socialConnection.push(row);
  return row;
}

function seedDestination(n, overrides = {}) {
  const row = {
    id: `dest-${n}`, label: `Owner ${n}`, status: 'CONNECTED', memberUrn: `urn:li:person:own${n}`, memberName: `Owner ${n}`, enabled: true, isPrimary: n === 1,
    encryptedAccessToken: encryptMeetingSecret(`platform-access-token-${n}`), encryptedRefreshToken: null, accessTokenExpiresAt: FUTURE(), refreshTokenExpiresAt: null,
    scopes: ['openid', 'profile', 'w_member_social'], createdAt: new Date(Date.now() + n), ...overrides,
  };
  db.linkedInDestination.push(row);
  return row;
}

function okResponse(urn) {
  return { ok: true, status: 201, headers: { get: (h) => (h.toLowerCase() === 'x-restli-id' ? urn : null) }, text: async () => '' };
}
function errResponse(status, body = {}, headers = {}) {
  return { ok: false, status, headers: { get: (h) => headers[h.toLowerCase()] ?? null }, text: async () => JSON.stringify(body) };
}

const task = (postId) => ({ id: 'run', type: 'LINKEDIN_POST', payload: { postId }, entityId: postId });
const posts = (type) => db.linkedInPost.filter((p) => !type || p.destinationType === type);

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  dist = await import('../services/linkedin/linkedinDistributionService.js');
  platform = await import('../services/linkedin/linkedinPlatformService.js');
  attribution = await import('../services/linkedin/linkedinAttributionService.js');
  composer = await import('../services/linkedin/linkedinPostComposer.js');
  client = await import('../services/linkedin/linkedinApiClient.js');
  ({ platformRouter } = await import('../routes/platformRoutes.js'));
  ({ isPlatformSuperAdmin } = await import('../middleware/platformAdmin.js'));
  ({ encryptMeetingSecret } = await import('../meeting/meetingEncryptionService.js'));
});

beforeEach(() => {
  env.meetingTokenEncryptionKey = 'a'.repeat(64);
  env.linkedinPublishingEnabled = true;
  env.linkedinClientId = 'cid';
  env.linkedinClientSecret = 'csecret';
  env.linkedinRedirectUri = 'http://localhost:5000/api/social/linkedin/callback';
  env.platformSuperAdminEmail = 'owner@careeriz.test';
  env.publicAppUrl = 'https://careeriz.example.com';
  env.linkedinAllowNonPublicUrl = false;
  installFakePrisma();
  fetchCalls = [];
  fetchImpl = () => okResponse('urn:li:share:111');
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return fetchImpl(String(url), options);
  };
});

afterEach(() => { globalThis.fetch = realFetch; });

// 1 -----------------------------------------------------------------------
test('recruiter opt-in YES queues a recruiter post that publishes via the Posts API', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  const summary = await dist.enqueueJobDistribution(job.id, { actorUserId: 'u1' });
  assert.equal(summary.recruiter, 'QUEUED');
  assert.equal(posts('RECRUITER').length, 1);
  assert.equal(db.backgroundTask.length, 1);
  assert.equal(db.backgroundTask[0].type, 'LINKEDIN_POST');

  await dist.processLinkedInPostTask(task(posts()[0].id));
  const post = posts()[0];
  assert.equal(post.status, 'PUBLISHED');
  assert.equal(post.linkedinPostId, 'urn:li:share:111');
  assert.match(post.postUrl, /linkedin\.com\/feed\/update\//);
  const call = fetchCalls[0];
  assert.equal(call.url, 'https://api.linkedin.com/rest/posts');
  assert.ok(call.options.headers['Linkedin-Version']);
  const body = JSON.parse(call.options.body);
  assert.equal(body.author, 'urn:li:person:rec1');
  assert.match(body.content.article.source, /\/jobs\/senior-engineer\?li=[a-f0-9]{16}$/);
});

// 2 -----------------------------------------------------------------------
test('recruiter opt-in NO queues no recruiter post; YES without a connection queues nothing but reports NOT_CONNECTED', async () => {
  const no = seedJob({ shareOnLinkedIn: false });
  seedConnection();
  await dist.enqueueJobDistribution(no.id);
  assert.equal(posts('RECRUITER').length, 0);

  db.socialConnection.length = 0;
  const yes = seedJob({ shareOnLinkedIn: true, slug: 'other' });
  const summary = await dist.enqueueJobDistribution(yes.id);
  assert.equal(summary.recruiter, 'NOT_CONNECTED');
  assert.equal(posts().length, 0);
});

// 3 -----------------------------------------------------------------------
test('platform distribution runs independently of the recruiter opt-in and respects the auto switch', async () => {
  const job = seedJob({ shareOnLinkedIn: false });
  seedDestination(1);
  seedDestination(2);

  await dist.enqueueJobDistribution(job.id); // auto switch OFF
  assert.equal(posts().length, 0);

  db.linkedInPlatformSettings.push({ id: 'default', autoDistribute: true });
  await dist.enqueueJobDistribution(job.id);
  assert.equal(posts('PLATFORM').length, 2);
  assert.equal(posts('RECRUITER').length, 0);
  assert.notEqual(posts()[0].commentary, composer.composeJobPost(db.job[0], { destinationType: 'RECRUITER' }).commentary.replace(/\?li=\w+/, ''));
});

// 4 -----------------------------------------------------------------------
test('draft, closed, expired, not-yet-open and internal jobs never enter the queue', async () => {
  seedConnection();
  db.linkedInPlatformSettings.push({ id: 'default', autoDistribute: true });
  seedDestination(1);
  const bad = [
    seedJob({ status: 'DRAFT', shareOnLinkedIn: true }),
    seedJob({ status: 'CLOSED', shareOnLinkedIn: true }),
    seedJob({ applicationClosesAt: new Date(Date.now() - 1000), shareOnLinkedIn: true }),
    seedJob({ applicationOpensAt: new Date(Date.now() + 86400000), shareOnLinkedIn: true }),
    seedJob({ visibility: 'INTERNAL', shareOnLinkedIn: true }),
  ];
  for (const job of bad) await dist.enqueueJobDistribution(job.id);
  assert.equal(posts().length, 0);
  assert.equal(db.backgroundTask.length, 0);
});

// 5 -----------------------------------------------------------------------
test('a LinkedIn outage leaves the Careeriz job published, and enqueue errors never throw', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  fetchImpl = () => errResponse(503, { message: 'down' });
  await dist.processLinkedInPostTask(task(posts()[0].id));
  assert.equal(posts()[0].status, 'RETRYING');
  assert.equal(posts()[0].lastErrorCategory, 'TRANSIENT');
  assert.ok(posts()[0].nextAttemptAt > new Date());
  assert.equal(db.job[0].status, 'OPEN');

  const original = prisma.linkedInPost.create;
  prisma.linkedInPost.create = async () => { throw new Error('db down'); };
  const other = seedJob({ shareOnLinkedIn: true, slug: 'x' });
  const summary = await dist.enqueueJobDistribution(other.id);
  assert.equal(summary.error, 'ENQUEUE_FAILED');
  prisma.linkedInPost.create = original;
});

// 6 -----------------------------------------------------------------------
test('duplicate events, re-delivered tasks and concurrent workers publish exactly one post', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  await dist.enqueueJobDistribution(job.id);
  await dist.enqueueJobDistribution(job.id);
  assert.equal(posts().length, 1);
  assert.equal(db.backgroundTask.length, 1);

  await Promise.all([dist.processLinkedInPostTask(task(posts()[0].id)), dist.processLinkedInPostTask(task(posts()[0].id))]);
  await dist.processLinkedInPostTask(task(posts()[0].id));
  assert.equal(fetchCalls.length, 1);
  assert.equal(posts()[0].status, 'PUBLISHED');

  // Re-publishing (e.g. CLOSED -> OPEN) never creates a second post.
  await dist.enqueueJobDistribution(job.id);
  assert.equal(posts().length, 1);
  assert.equal(fetchCalls.length, 1);
});

test('retryable failures use bounded exponential backoff, then need action', async () => {
  assert.ok(dist.linkedInBackoffMs(1) < dist.linkedInBackoffMs(3));
  assert.equal(dist.linkedInBackoffMs(50), 30 * 60_000);
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  fetchImpl = () => errResponse(429, {}, { 'retry-after': '120' });
  await dist.processLinkedInPostTask(task(posts()[0].id));
  assert.equal(posts()[0].status, 'RETRYING');
  assert.equal(posts()[0].lastErrorCategory, 'RATE_LIMITED');
  assert.ok(posts()[0].nextAttemptAt.getTime() - Date.now() >= 119_000);
  // Exhaust attempts.
  for (let i = 0; i < dist.MAX_ATTEMPTS; i += 1) {
    posts()[0].nextAttemptAt = null;
    if (posts()[0].status === 'RETRYING') await dist.processLinkedInPostTask(task(posts()[0].id));
  }
  assert.equal(posts()[0].status, 'FAILED');
  assert.match(posts()[0].lastErrorMessage, /retries exhausted/);
});

test('a stale PUBLISHING claim is parked as UNKNOWN_OUTCOME instead of being blindly re-posted', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  Object.assign(db.linkedInPost[0], { status: 'PUBLISHING', claimedAt: new Date(Date.now() - 3600_000) });
  await dist.processLinkedInPostTask(task(db.linkedInPost[0].id));
  assert.equal(db.linkedInPost[0].status, 'NEEDS_ACTION');
  assert.equal(db.linkedInPost[0].lastErrorCategory, 'UNKNOWN_OUTCOME');
  assert.equal(fetchCalls.length, 0);
});

// 7 -----------------------------------------------------------------------
test('expired tokens and revoked permissions require user action and never hit the posts endpoint blindly', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  const conn = seedConnection({ accessTokenExpiresAt: new Date(Date.now() - 1000) });
  await dist.enqueueJobDistribution(job.id);
  await dist.processLinkedInPostTask(task(posts()[0].id));
  assert.equal(posts()[0].status, 'NEEDS_ACTION');
  assert.equal(posts()[0].lastErrorCategory, 'AUTH_EXPIRED');
  assert.equal(db.socialConnection[0].status, 'EXPIRED');
  assert.equal(fetchCalls.length, 0);

  // Revoked at LinkedIn (403) on a valid-looking token.
  db.linkedInPost.length = 0; db.backgroundTask.length = 0;
  Object.assign(conn, { status: 'CONNECTED', accessTokenExpiresAt: FUTURE() });
  await dist.enqueueJobDistribution(job.id);
  fetchImpl = () => errResponse(403, { message: 'ACCESS_DENIED' });
  await dist.processLinkedInPostTask(task(posts()[0].id));
  assert.equal(posts()[0].lastErrorCategory, 'PERMISSION_DENIED');
  assert.equal(posts()[0].status, 'NEEDS_ACTION');
  assert.equal(db.socialConnection[0].status, 'REVOKED');

  // Token lacking the publish scope is rejected before any API call.
  db.linkedInPost.length = 0; db.backgroundTask.length = 0; fetchCalls.length = 0;
  Object.assign(conn, { status: 'CONNECTED', scopes: ['openid', 'profile'] });
  await dist.enqueueJobDistribution(job.id);
  await dist.processLinkedInPostTask(task(posts()[0].id));
  assert.equal(posts()[0].lastErrorCategory, 'PERMISSION_DENIED');
  assert.equal(fetchCalls.length, 0);
});

test('publishing stays disabled (NEEDS_ACTION, nothing sent) until LINKEDIN_PUBLISHING_ENABLED is on', async () => {
  env.linkedinPublishingEnabled = false;
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  assert.equal(posts()[0].status, 'NEEDS_ACTION');
  assert.equal(posts()[0].lastErrorCategory, 'PUBLISHING_DISABLED');
  assert.equal(db.backgroundTask.length, 0);
  assert.equal(fetchCalls.length, 0);
  await assert.rejects(platform.updatePlatformSettings({ id: 'admin' }, { autoDistribute: true }), /disabled on the server/);
});

// 8 -----------------------------------------------------------------------
test('platform-owned tokens are not serialised and the platform router is super-admin-only', async () => {
  const dest = seedDestination(1, { encryptedRefreshToken: encryptMeetingSecret('refresh-secret') });
  const serialized = JSON.stringify(platform.serializeDestination(dest));
  assert.ok(!/encrypted|platform-access-token|refresh-secret|iv|ciphertext/i.test(serialized.replace('Verified', '')));
  assert.equal(JSON.parse(serialized).hasRefreshToken, true);

  // Router-level guards come first, before every LinkedIn route.
  const layers = platformRouter.stack;
  assert.equal(layers[0].name, '<anonymous>'); // auth()
  assert.ok(layers[1].handle.length === 3);
  const linkedInRoutes = layers.filter((l) => l.route?.path?.startsWith('/linkedin'));
  assert.ok(linkedInRoutes.length >= 10);
  assert.ok(layers.indexOf(linkedInRoutes[0]) > 1);

  // The guard itself rejects org admins/recruiters, including a spoofed role.
  assert.equal(isPlatformSuperAdmin({ email: 'recruiter@acme.test', role: 'ADMIN', isActive: true }), false);
  assert.equal(isPlatformSuperAdmin({ email: 'owner@careeriz.test', isActive: true }), true);

  // Recruiter-scoped retry can never touch a PLATFORM post.
  const job = seedJob();
  db.linkedInPost.push({ id: 'p-plat', jobId: job.id, organisationId: 'org-1', destinationType: 'PLATFORM', destinationId: dest.id, status: 'FAILED', commentary: 'x', trackingRef: 'a'.repeat(16) });
  await assert.rejects(dist.retryLinkedInPost('p-plat', { actorUserId: 'u', organisationId: 'org-1', scope: 'recruiter' }), /not found/i);
});

// 9 -----------------------------------------------------------------------
test('multiple platform destinations publish independently', async () => {
  const job = seedJob();
  db.linkedInPlatformSettings.push({ id: 'default', autoDistribute: true });
  seedDestination(1);
  seedDestination(2);
  await dist.enqueueJobDistribution(job.id);
  fetchImpl = (url, options) => (options.headers.Authorization.includes('platform-access-token-1')
    ? okResponse('urn:li:share:A') : errResponse(401, { message: 'expired' }));
  for (const p of posts()) await dist.processLinkedInPostTask(task(p.id));
  const [first, second] = posts();
  assert.equal(first.status, 'PUBLISHED');
  assert.equal(first.authorUrn, 'urn:li:person:own1');
  assert.equal(second.status, 'NEEDS_ACTION');
  assert.equal(second.authorUrn, 'urn:li:person:own2');
  assert.equal(db.linkedInDestination[1].status, 'EXPIRED');
  assert.equal(db.linkedInDestination[0].status, 'CONNECTED');
});

// 10 ----------------------------------------------------------------------
test('job exclusion, manual retry and audit records', async () => {
  const job = seedJob();
  db.linkedInPlatformSettings.push({ id: 'default', autoDistribute: true });
  seedDestination(1);
  await dist.enqueueJobDistribution(job.id);
  const admin = { id: 'admin-1' };

  const result = await platform.setJobPlatformExclusion(admin, job.id, true);
  assert.equal(result.cancelledPosts, 1);
  assert.equal(posts()[0].status, 'CANCELLED');
  assert.equal(db.job[0].excludeFromPlatformLinkedIn, true);
  assert.ok(db.auditLog.some((a) => a.action === 'linkedin.platform.job.exclude' && a.actorUserId === 'admin-1'));
  await assert.rejects(platform.retryPlatformPost(admin, posts()[0].id), /excluded/);
  await assert.rejects(platform.distributeJobNow(admin, job.id), /excluded/);

  await platform.setJobPlatformExclusion(admin, job.id, false);
  posts()[0].status = 'FAILED';
  const retried = await platform.retryPlatformPost(admin, posts()[0].id);
  assert.equal(retried.status, 'QUEUED');
  assert.equal(posts()[0].status, 'QUEUED');
  assert.ok(db.auditLog.some((a) => a.action === 'linkedin.post.retry' && a.metadata.scope === 'platform'));
  assert.equal(db.backgroundTask.length, 2);
  await assert.rejects(platform.retryPlatformPost(admin, posts()[0].id), /cannot be retried/);

  // Disabling a destination cancels its pending work; primary requires a connection.
  await platform.updateDestination(admin, 'dest-1', { enabled: false });
  assert.equal(posts()[0].status, 'CANCELLED');
  db.linkedInDestination[0].status = 'EXPIRED';
  await assert.rejects(platform.updateDestination(admin, 'dest-1', { isPrimary: true }), /connected/);
});

// 11 ----------------------------------------------------------------------
test('attribution records the correct source, de-duplicates and distrusts unproven outcomes', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  const ref = posts()[0].trackingRef;
  const visitorId = 'a1b2c3d4e5f60718';

  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'CLICK', visitorId })).recorded, true);
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'CLICK', visitorId })).recorded, false);
  assert.equal((await attribution.recordAttributionEvent({ ref: 'f'.repeat(16), eventType: 'CLICK', visitorId })).recorded, false);
  await assert.rejects(attribution.recordAttributionEvent({ ref, eventType: 'REGISTRATION_COMPLETE', visitorId }), /Sign-in required/);
  await assert.rejects(attribution.recordAttributionEvent({ ref: 'nope', eventType: 'CLICK', visitorId }), /Invalid reference/);

  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'REGISTRATION_COMPLETE', userId: 'cand-1' })).recorded, false); // no proof yet
  db.user.push({ id: 'cand-1', createdAt: new Date() });
  db.user.push({ id: 'old-user', createdAt: new Date(Date.now() - 400 * 86400000) });
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'REGISTRATION_COMPLETE', userId: 'old-user' })).recorded, false); // returning user, not a new registration
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'REGISTRATION_COMPLETE', userId: 'cand-1' })).recorded, true);
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'RESUME_UPLOAD', userId: 'cand-1' })).recorded, false);
  db.resumeAsset.push({ id: 'r1', ownerUserId: 'cand-1', kind: 'RESUME', createdAt: new Date() });
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'RESUME_UPLOAD', userId: 'cand-1' })).recorded, true);
  db.candidateProfile.push({ id: 'cp1', userId: 'cand-1', profileCompletenessScore: 50 });
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'PROFILE_COMPLETE', userId: 'cand-1' })).recorded, false);
  db.candidateProfile[0].profileCompletenessScore = 90;
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'PROFILE_COMPLETE', userId: 'cand-1' })).recorded, true);
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'APPLICATION', userId: 'cand-1' })).recorded, false); // no application row
  db.application.push({ id: 'app-1', jobId: job.id, candidate: { userId: 'cand-1' }, appliedAt: new Date() });
  assert.equal((await attribution.recordAttributionEvent({ ref, eventType: 'APPLICATION', userId: 'cand-1' })).recorded, true);

  Object.assign(posts()[0], { status: 'PUBLISHED', publishedAt: new Date(), job: { title: 'Senior Engineer' } });
  const report = await attribution.getAttributionReport();
  assert.equal(report.basis, 'MEASURED_FIRST_PARTY');
  assert.ok(report.unavailable.includes('impressions'));
  const row = report.byPost[0];
  assert.equal(row.CLICK, 1);
  assert.equal(row.REGISTRATION_COMPLETE, 1);
  assert.equal(row.RESUME_UPLOAD, 1);
  assert.equal(row.PROFILE_COMPLETE, 1);
  assert.equal(row.APPLICATION, 1);
  assert.equal(row.clickToApplicationRate, 100);
  assert.equal(report.byDestination[0].destinationType, 'RECRUITER');
});

// 12 ----------------------------------------------------------------------
test('LinkedIn API errors are stored without leaking credentials', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  fetchImpl = () => errResponse(400, { message: 'bad Bearer recruiter-access-token access_token=recruiter-access-token', code: 'X' });
  await dist.processLinkedInPostTask(task(posts()[0].id));
  const post = posts()[0];
  assert.equal(post.status, 'FAILED');
  assert.equal(post.lastErrorCategory, 'INVALID_REQUEST');
  assert.ok(!JSON.stringify(post).includes('recruiter-access-token'));
  assert.ok(!JSON.stringify(dist.serializeLinkedInPost(post)).includes('recruiter-access-token'));
  assert.ok(!client.redactSecrets('{"access_token":"abc123","refresh_token":"zzz"} Bearer qqq.rrr').match(/abc123|zzz|qqq/));
});

test('ambiguous failures while creating the post are never auto-retried (no duplicate posts)', async () => {
  const cases = [
    ['connection reset mid-request', () => { throw new Error('ECONNRESET'); }],
    ['timeout', () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }],
    ['HTTP 500', () => errResponse(500, { message: 'boom' })],
    ['HTTP 502', () => errResponse(502, {})],
    ['HTTP 504', () => errResponse(504, {})],
  ];
  for (const [label, impl] of cases) {
    installFakePrisma();
    fetchCalls = [];
    const job = seedJob({ shareOnLinkedIn: true });
    seedConnection();
    await dist.enqueueJobDistribution(job.id);
    fetchImpl = impl;
    await dist.processLinkedInPostTask(task(posts()[0].id));
    assert.equal(posts()[0].status, 'NEEDS_ACTION', label);
    assert.equal(posts()[0].lastErrorCategory, 'UNKNOWN_OUTCOME', label);
    // A re-delivered task must NOT call LinkedIn again.
    await dist.processLinkedInPostTask(task(posts()[0].id));
    assert.equal(fetchCalls.length, 1, label);
  }
});

test('failures that prove the request was not processed are retried (503, 429, DNS failure)', async () => {
  for (const impl of [
    () => errResponse(503, {}),
    () => errResponse(429, {}),
    () => { throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { cause: { code: 'ENOTFOUND' } }); },
  ]) {
    installFakePrisma();
    const job = seedJob({ shareOnLinkedIn: true });
    seedConnection();
    await dist.enqueueJobDistribution(job.id);
    fetchImpl = impl;
    await dist.processLinkedInPostTask(task(posts()[0].id));
    assert.equal(posts()[0].status, 'RETRYING');
  }
});

test('a database failure AFTER LinkedIn accepted the post never causes a second post', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection();
  await dist.enqueueJobDistribution(job.id);
  const realUpdate = prisma.linkedInPost.update;
  prisma.linkedInPost.update = async (args) => {
    if (args.data.status === 'PUBLISHED') throw new Error('db connection lost');
    return realUpdate(args);
  };
  await dist.processLinkedInPostTask(task(posts()[0].id));
  prisma.linkedInPost.update = realUpdate;

  assert.equal(fetchCalls.length, 1);
  assert.equal(posts()[0].status, 'PUBLISHING'); // not RETRYING
  await dist.processLinkedInPostTask(task(posts()[0].id)); // redelivery while claim is fresh
  assert.equal(fetchCalls.length, 1);

  posts()[0].claimedAt = new Date(Date.now() - 3600_000); // claim goes stale
  await dist.sweepLinkedInPosts();
  assert.equal(posts()[0].status, 'NEEDS_ACTION');
  assert.equal(posts()[0].lastErrorCategory, 'UNKNOWN_OUTCOME');
  assert.equal(fetchCalls.length, 1);
});

test('the same LinkedIn member as recruiter and platform profile gets ONE post per job', async () => {
  const job = seedJob({ shareOnLinkedIn: true });
  seedConnection(); // recruiter member urn:li:person:rec1
  db.linkedInPlatformSettings.push({ id: 'default', autoDistribute: true });
  seedDestination(1, { memberUrn: 'urn:li:person:rec1' }); // owner is also the recruiter
  await dist.enqueueJobDistribution(job.id);
  assert.equal(posts().length, 1);
  assert.equal(db.backgroundTask.length, 1);
  assert.equal(posts()[0].destinationType, 'RECRUITER');
});

test('a post whose Careeriz link is not publicly reachable is refused before any API call', async () => {
  for (const url of ['http://localhost:3000', 'http://192.168.1.5:3000', 'http://careeriz.example.com', 'https://intranet']) {
    installFakePrisma();
    fetchCalls = [];
    env.publicAppUrl = url;
    const job = seedJob({ shareOnLinkedIn: true });
    seedConnection();
    await dist.enqueueJobDistribution(job.id);
    await dist.processLinkedInPostTask(task(posts()[0].id));
    assert.equal(posts()[0].status, 'FAILED', url);
    assert.equal(posts()[0].lastErrorCategory, 'INVALID_REQUEST', url);
    assert.equal(fetchCalls.length, 0, url);
  }
  env.publicAppUrl = 'http://localhost:3000';
  env.linkedinAllowNonPublicUrl = true; // explicit dev override
  assert.equal(composer.getPublicUrlProblem('http://localhost:3000/jobs/x'), null);
  env.linkedinAllowNonPublicUrl = false;
  assert.equal(composer.getPublicUrlProblem('https://careeriz.example.com/jobs/x'), null);
});

// Platform OAuth ------------------------------------------------------------
test('platform OAuth binds to the verified member id and rejects other profiles', async () => {
  const dest = seedDestination(1, { status: 'PENDING_AUTH', memberUrn: null, scopes: null, encryptedAccessToken: null });
  const state = { context: { destinationId: dest.id, userId: 'admin-1' }, user: { email: 'owner@careeriz.test', isActive: true }, userId: 'admin-1' };
  fetchImpl = (url) => (url.includes('accessToken')
    ? { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ access_token: 'new-token', expires_in: 5184000, scope: 'openid,profile,w_member_social' }) }
    : { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ sub: 'abc123', name: 'Vinu' }) });

  await platform.completeDestinationOAuth('code', state);
  assert.equal(db.linkedInDestination[0].memberUrn, 'urn:li:person:abc123');
  assert.equal(db.linkedInDestination[0].status, 'CONNECTED');
  assert.ok(!JSON.stringify(db.linkedInDestination[0]).includes('new-token')); // stored encrypted only

  // Reconnect with a different LinkedIn profile is refused.
  fetchImpl = (url) => (url.includes('accessToken')
    ? { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ access_token: 't2', expires_in: 100, scope: 'w_member_social' }) }
    : { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ sub: 'someone-else' }) });
  await assert.rejects(platform.completeDestinationOAuth('code', state), (e) => e.code === 'IDENTITY_MISMATCH');

  // A state token issued to a non-admin session is refused.
  await assert.rejects(platform.completeDestinationOAuth('code', { ...state, user: { email: 'recruiter@acme.test', isActive: true } }), /administrator/i);

  // Email alone never authorizes: a destination with only a setup email cannot publish.
  const emailOnly = { id: 'dest-9', status: 'PENDING_AUTH', setupEmail: 'vinu842@gmail.com', memberUrn: null, enabled: true, scopes: null };
  assert.equal(platform.serializeDestination(emailOnly).canPublish, false);
  assert.deepEqual(platform.SETUP_EMAIL_SUGGESTIONS, ['vinu842@gmail.com', 'eyeblue842@gmail.com']);
});

test('platform OAuth requires the w_member_social grant', async () => {
  const dest = seedDestination(1, { status: 'PENDING_AUTH', memberUrn: null, scopes: null, encryptedAccessToken: null });
  fetchImpl = () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ access_token: 't', expires_in: 100, scope: 'openid,profile' }) });
  await assert.rejects(
    platform.completeDestinationOAuth('code', { context: { destinationId: dest.id }, user: { email: 'owner@careeriz.test', isActive: true } }),
    (e) => e.code === 'PERMISSION_DENIED',
  );
  assert.equal(db.linkedInDestination[0].status, 'REVOKED');
});

// Composer ------------------------------------------------------------------
test('post composer uses only public fields, a canonical URL, and escapes LinkedIn reserved characters', () => {
  const job = { ...seedJob(), description: 'Great <b>role</b> with team_work (remote) and [more]', locations: [] };
  const rec = composer.composeJobPost(job, { destinationType: 'RECRUITER', trackingRef: 'abcdef0123456789', companyName: 'Acme' });
  const plat = composer.composeJobPost(job, { destinationType: 'PLATFORM', trackingRef: 'abcdef0123456789', companyName: 'Acme' });
  for (const text of [rec.commentary, plat.commentary]) {
    assert.ok(!text.includes('999999') && !text.includes('SECRET-NOTE'));
    assert.ok(text.includes('/jobs/senior-engineer?li=abcdef0123456789'));
    assert.ok((text.match(/#\w+/g) || []).length <= 2);
  }
  assert.notEqual(rec.commentary, plat.commentary);
  assert.equal(client.escapeCommentary('a_b (c) [d] {e} @f'), 'a\\_b \\(c\\) \\[d\\] \\{e\\} \\@f');
  assert.equal(composer.getJobShareIneligibility({ ...job, status: 'DRAFT' }) !== null, true);
});
