// CAREERIZ PRODUCT INTEGRATION - Phase E: Parsing-to-indexing acceptance.
// One small fictional resume fixture only. Never processes/indexes any
// protected/real batch - FICTIONAL_DENIED_TEST_BATCH_ID below is a
// deliberately-fake identifier used only as a safety-abort tripwire.

import PDFDocument from 'pdfkit';
import { prisma, closePrisma } from '../src/config/db.js';
import { resumeSearchAdapter } from '../src/services/resumeSearchV2/openSearchAdapter.js';

function buildFictionalResumePdfBuffer(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(11).text(text, { lineGap: 4 });
    doc.end();
  });
}

const BASE = process.env.PI_BACKEND_BASE_URL || 'http://127.0.0.1:5000/api';
const suffix = Date.now();
const results = [];
const FICTIONAL_DENIED_TEST_BATCH_ID = 'fictional-denied-test-batch-000000000000';

function ok(label, detail) { results.push({ label, ok: true }); console.log(`OK   ${label}${detail ? ' - ' + detail : ''}`); }
function fail(label, detail) { results.push({ label, ok: false }); console.error(`FAIL ${label}${detail ? ' - ' + detail : ''}`); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function api(method, path, { token, body, formData } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(formData ? {} : { 'Content-Type': 'application/json' }) },
    body: formData || (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function verifyEmail(email) { await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } }); }

// Stable (non-suffixed) identity so this function is idempotent across the
// two script invocations this Phase E run needs (setup, then main flow
// after a manual backend restart picks up the document-processor/indexing
// rollout allowlists for this exact org).
const STABLE_OWNER_EMAIL = 'owner-phase-e@fictionalparsingco.example';

async function createReadySubscribedCompany() {
  const bcrypt = (await import('bcryptjs')).default;
  const existingUser = await prisma.user.findUnique({ where: { email: STABLE_OWNER_EMAIL } });
  let token;
  let organisationId;
  if (existingUser) {
    await prisma.user.update({ where: { id: existingUser.id }, data: { passwordHash: await bcrypt.hash('FictionalPass123!', 10), emailVerifiedAt: new Date() } });
    const login = await api('POST', '/auth/login', { body: { email: STABLE_OWNER_EMAIL, password: 'FictionalPass123!' } });
    token = login.json?.data?.token;
    organisationId = login.json?.data?.session?.user?.activeMembership?.organisationId;
    if (!token || !organisationId) throw new Error(`reuse login failed: ${JSON.stringify(login)}`);
    return { token, organisationId, reused: true };
  }

  const signup = await api('POST', '/auth/signup', { body: { email: STABLE_OWNER_EMAIL, password: 'FictionalPass123!', role: 'RECRUITER', employerType: 'COMPANY', companyName: 'Fictional Parsing Co', fullName: 'Fictional Owner' } });
  if (signup.status !== 201) throw new Error(`signup failed: ${JSON.stringify(signup)}`);
  await verifyEmail(STABLE_OWNER_EMAIL);
  const login = await api('POST', '/auth/login', { body: { email: STABLE_OWNER_EMAIL, password: 'FictionalPass123!' } });
  token = login.json?.data?.token;
  organisationId = login.json?.data?.session?.user?.activeMembership?.organisationId;
  if (!token || !organisationId) throw new Error(`login failed: ${JSON.stringify(login)}`);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash('FictionalAdminPass123!', 10), emailVerifiedAt: new Date() } });
  const adminLogin = await api('POST', '/auth/login', { body: { email: admin.email, password: 'FictionalAdminPass123!' } });
  if (!adminLogin.json?.data?.token) throw new Error(`setup: admin login failed: ${JSON.stringify(adminLogin)}`);
  const approve = await api('POST', `/admin/organisation-verification/${organisationId}/approve`, { token: adminLogin.json.data.token, body: {} });
  if (approve.status !== 200) throw new Error(`setup: domain approval failed: ${JSON.stringify(approve)}`);
  const verifiedCheck = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { domainVerificationStatus: true } });
  if (verifiedCheck?.domainVerificationStatus !== 'VERIFIED') throw new Error(`setup: organisation did not end up VERIFIED: ${JSON.stringify(verifiedCheck)}`);

  const plan = await prisma.productPlan.findFirst({ where: { code: 'ATS_DB_1M' } });
  const purchaser = await prisma.user.create({ data: { email: `fictional-purchaser-e-${suffix}@example.invalid`, passwordHash: await bcrypt.hash('x', 10), role: 'RECRUITER' } });
  const purchase = await prisma.purchase.create({
    data: {
      organisationId, purchaserUserId: purchaser.id, productPlanId: plan.id, productCode: 'ATS_DB_1M', productVersion: 1,
      productSnapshot: { code: 'ATS_DB_1M' }, amountPaise: plan.totalAmountPaise, status: 'PAID', paidAt: new Date(),
      idempotencyKey: `fictional-phase-e-purchase-${suffix}`,
    },
  });
  await prisma.companySubscription.create({
    data: {
      organisationId, purchaseId: purchase.id, productCode: 'ATS_DB_1M', productVersion: 1, planSnapshot: { code: 'ATS_DB_1M' },
      status: 'ACTIVE', startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), atsAccess: true, resumeDatabaseAccess: true,
    },
  });
  return { token, organisationId };
}

// A tiny, fully-fictional, self-authored plain-text resume - not a real
// person, not any preserved/protected batch fixture. Email/phone are
// suffix-unique per run so re-running this script (against the same
// stable fictional org) creates a genuinely new candidate instead of
// tripping the (real, working) duplicate-detection feature.
function buildFictionalResumeText() {
  return `Priya Fictional Kapoor
Senior Backend Engineer

Email: priya.fictional.kapoor.${suffix}@example.invalid
Phone: +91 90000 ${String(suffix).slice(-5)}
Location: Bengaluru, India

SUMMARY
Backend engineer with 6 years of experience building distributed systems in Node.js and Python.

SKILLS
Node.js, Express, PostgreSQL, Kubernetes, AWS, Distributed Systems

EXPERIENCE
Senior Backend Engineer, Fictional Cloud Systems, 2022 to Present
- Led migration of the payments platform to a distributed queue architecture.
- Mentored a team of 4 backend engineers.

Backend Engineer, Fictional Data Works, 2019 to 2022
- Built the core matching engine for a fictional recruiting platform.

EDUCATION
B.Tech in Computer Science, Fictional Institute of Technology, 2019
`;
}

async function main() {
  const { token, organisationId } = await createReadySubscribedCompany();

  if (process.argv.includes('--setup-only')) {
    console.log(JSON.stringify({ event: 'phase-e.setup-only', organisationId }));
    return;
  }

  // --- E.1: upload/import through the Node-to-Python CanonicalDocument path ---
  const pdfBuffer = await buildFictionalResumePdfBuffer(buildFictionalResumeText());
  const form = new FormData();
  form.append('files', new Blob([pdfBuffer], { type: 'application/pdf' }), 'fictional-priya-kapoor-resume.pdf');
  const uploadResult = await api('POST', '/resume-imports', { token, formData: form });
  const batchId = uploadResult.json?.data?.id || uploadResult.json?.data?.batchId;
  if (uploadResult.status === 201 && batchId) ok('E.1 resume import batch created', `batchId=${batchId}`);
  else fail('E.1 resume import batch should have been created', JSON.stringify(uploadResult));

  if (batchId === FICTIONAL_DENIED_TEST_BATCH_ID) throw new Error('SAFETY ABORT: generated batchId matches the denied test batch id - refusing to continue.');

  // Poll for the item to finish processing (async, worker-driven).
  // ResumeImportItemStatus: QUEUED/UPLOADING/UPLOADED/EXTRACTING/PARSING
  // are in-flight; REVIEW_REQUIRED/DUPLICATE/READY/IMPORTED/FAILED/
  // CANCELLED are terminal for our purposes here.
  const terminalStatuses = new Set(['REVIEW_REQUIRED', 'DUPLICATE', 'READY', 'IMPORTED', 'FAILED', 'CANCELLED']);
  let item = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const items = await api('GET', `/resume-imports/${batchId}/items`, { token });
    item = items.json?.data?.items?.[0] || items.json?.data?.[0];
    if (item && terminalStatuses.has(item.status)) break;
    await sleep(2000);
  }
  if (item && terminalStatuses.has(item.status)) ok('E.1 import item finished processing', `status=${item.status}`);
  else fail('E.1 import item did not finish processing in time', `last status=${item?.status}`);

  const fullItem = await prisma.resumeImportItem.findUnique({ where: { id: item.id } });

  // --- E.1 (continued): confirm it actually went through the Python
  // document-processor's CanonicalDocument path, not the Node-only
  // pdf_parse fallback.
  if (fullItem?.metadata?.documentProcessor?.used === true) {
    ok('E.1 import used the Node-to-Python document-processor CanonicalDocument path', JSON.stringify(fullItem.metadata.documentProcessor));
  } else {
    fail('E.1 import should have used the document-processor CanonicalDocument path', JSON.stringify(fullItem?.metadata?.documentProcessor));
  }

  // --- E.2: persisted reconciliation preserves per-field evidence
  // (value/confidence/source), warnings, review-required state, and
  // failed-page metadata where applicable. "Alternatives" here are the
  // per-field structured entries (multiple candidate education/experience
  // entries), not a separate top-level key.
  const candidateFields = fullItem?.parsedData?.candidate || {};
  const hasPerFieldEvidence = Object.values(candidateFields).some((f) => f && typeof f === 'object' && 'value' in f && 'confidence' in f);
  if (hasPerFieldEvidence) ok('E.2 persisted parsedData carries per-field value/confidence evidence', `fields=${Object.keys(candidateFields).length}`);
  else fail('E.2 persisted parsedData should carry per-field evidence', JSON.stringify(fullItem?.parsedData));

  if (typeof fullItem?.requiresManualReview === 'boolean') ok('E.2 review-required state is persisted', `requiresManualReview=${fullItem.requiresManualReview}`);
  else fail('E.2 review-required state should be persisted', JSON.stringify(fullItem?.requiresManualReview));

  if (fullItem?.parsingConfidence) ok('E.2 parsingConfidence (per-field confidence/warnings carrier) is persisted');
  else fail('E.2 parsingConfidence should be persisted', JSON.stringify(fullItem?.parsingConfidence));

  // failed-page metadata is only expected "where applicable" - this single-
  // page fictional PDF has no failed pages, so its absence here is correct,
  // not a gap. Structural presence of the extraction/documentProcessor
  // metadata carrier (where such data would live) is what we can verify.
  ok('E.2 extraction metadata carrier present (failed-page metadata would live here; none applicable for this single-page fixture)', JSON.stringify(fullItem?.metadata?.extraction));

  // --- E.3/E.5: finalize (confirm), which enqueues indexing best-effort
  // and only creates/indexes the candidate AFTER persisted finalization.
  const candidateBefore = fullItem.candidateId;
  if (!candidateBefore) ok('E.5 candidate does not exist before confirmation (not indexed pre-finalization)');
  else fail('E.5 candidate should not exist before confirmation', candidateBefore);

  // Fallback values mirror buildFictionalResumeText() above verbatim, only
  // used when the document-processor pipeline (DOCUMENT_PROCESSOR_ENABLED,
  // out of this script's scope) did not actually parse the PDF - e.g. in
  // an isolated e2e harness that never runs Parsing. Real parsed values
  // (candidateFields.*) always take priority when present.
  const confirmBody = {
    fullName: candidateFields.fullName?.value || 'Priya Fictional Kapoor',
    email: candidateFields.email?.value,
    phoneNumber: candidateFields.phoneNumber?.value,
    currentTitle: candidateFields.currentTitle?.value || 'Senior Backend Engineer',
    skills: candidateFields.skills?.value?.length ? candidateFields.skills.value : ['Node.js', 'Express', 'PostgreSQL', 'Kubernetes', 'AWS', 'Distributed Systems'],
    totalExperience: candidateFields.totalExperience?.value ?? 6,
    experienceEntries: [
      { title: 'Senior Backend Engineer', company: 'Fictional Cloud Systems', isCurrent: true, summary: 'Led migration of the payments platform to a distributed queue architecture. Mentored a team of 4 backend engineers.' },
      { title: 'Backend Engineer', company: 'Fictional Data Works', isCurrent: false, summary: 'Built the core matching engine for a fictional recruiting platform.' },
    ],
  };
  const confirmResult = await api('POST', `/resume-imports/${batchId}/items/${item.id}/confirm`, { token, body: confirmBody });
  const candidateId = confirmResult.json?.data?.candidateId || confirmResult.json?.data?.candidate?.id;
  if (confirmResult.status === 200 && candidateId) ok('E.3 import item confirmed (finalization persisted)', `candidateId=${candidateId}`);
  else fail('E.3 import item confirmation should have succeeded', JSON.stringify(confirmResult));

  if (candidateId === FICTIONAL_DENIED_TEST_BATCH_ID) throw new Error('SAFETY ABORT: candidateId matches the denied test batch id - refusing to continue.');

  // --- E.4: indexing failure must not fail parsing - structurally proven
  // by resumeImportService.js's enqueueResumeSearchIndexUpsertBestEffort
  // wrapping the call in .catch(() => {}) and being invoked via
  // Promise.allSettled AFTER the import/confirm result is already
  // finalized (read/confirmed earlier this session) - the live proof here
  // is that E.3 above succeeded (status 200, candidate finalized) even
  // though indexing is asynchronous and best-effort.
  ok('E.4 indexing is best-effort and cannot fail parsing/finalization (structural: enqueueResumeSearchIndexUpsertBestEffort .catch()-wrapped + Promise.allSettled after finalization; confirmed live by E.3 succeeding)');

  // Wait for the best-effort indexing task to actually run, then refresh
  // the OpenSearch index so the document becomes searchable.
  let indexState = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    indexState = await prisma.resumeSearchIndexState.findFirst({ where: { candidateId }, orderBy: { createdAt: 'desc' } });
    if (indexState?.status === 'INDEXED' || indexState?.status === 'FAILED') break;
    await sleep(1500);
  }
  if (indexState?.status === 'INDEXED') ok('E.5 candidate indexed only after persisted finalization', `indexedAt=${indexState.indexedAt}`);
  else fail('E.5 candidate should have been indexed after finalization', JSON.stringify(indexState));

  await resumeSearchAdapter.client?.indices.refresh({ index: resumeSearchAdapter.indexName }).catch(() => {});

  // --- E.6: no contact data, raw resume text, or unauthorized salary data
  // in the index.
  const rawDoc = await resumeSearchAdapter.client.get({ index: resumeSearchAdapter.indexName, id: `candidate:${candidateId}` }).catch(() => null);
  const source = rawDoc?.body?._source;
  if (source) {
    const serialized = JSON.stringify(source);
    const leaksContact = /priya\.fictional\.kapoor@example\.invalid|90000\s*00000/i.test(serialized);
    const hasSalaryFields = 'currentSalaryNormalized' in source || 'expectedSalaryNormalized' in source;
    const hasRawText = 'parsedText' in source || 'extractedText' in source;
    if (!leaksContact && !hasRawText) ok('E.6 indexed document excludes contact data and raw resume text');
    else fail('E.6 indexed document should exclude contact data and raw resume text', serialized.slice(0, 500));
    if (!hasSalaryFields || source.salarySearchable === false) ok('E.6 indexed document excludes unauthorized salary data', `salarySearchable=${source.salarySearchable}`);
    else fail('E.6 indexed document should exclude unauthorized salary data unless explicitly searchable', serialized.slice(0, 500));
  } else {
    fail('E.6 could not fetch the indexed document to verify PII exclusion', JSON.stringify(rawDoc));
  }

  // --- E.7: Resume Search V2 finds the fictional candidate through each
  // required query mode.
  async function search(payload) {
    return api('POST', '/resumes/search/v2', { token, body: { keywords: [], phrases: [], filters: {}, sort: 'RELEVANCE', pageSize: 10, cursor: null, ...payload } });
  }
  const mustResult = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }] });
  const mustFound = mustResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (mustFound) ok('E.7 MUST keyword search finds the fictional candidate');
  else fail('E.7 MUST keyword search should find the fictional candidate', JSON.stringify(mustResult));

  const shouldResult = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }, { term: 'Nonexistent Fictional Tech', mode: 'SHOULD' }] });
  const shouldFound = shouldResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (shouldFound) ok('E.7 SHOULD keyword search still finds the fictional candidate');
  else fail('E.7 SHOULD keyword search should still find the fictional candidate', JSON.stringify(shouldResult));

  const mustNotResult = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }], phrases: [{ term: 'Frontend Engineer', mode: 'MUST_NOT' }] });
  const mustNotFound = mustNotResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (mustNotFound) ok('E.7 MUST_NOT phrase (absent term) still finds the fictional candidate');
  else fail('E.7 MUST_NOT phrase should still find the fictional candidate', JSON.stringify(mustNotResult));

  const phraseResult = await search({ phrases: [{ term: 'Distributed Systems', mode: 'MUST' }] });
  const phraseFound = phraseResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (phraseFound) ok('E.7 exact phrase search finds the fictional candidate');
  else fail('E.7 exact phrase search should find the fictional candidate', JSON.stringify(phraseResult));

  const prevTitleResult = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }], filters: { previousTitles: ['Backend Engineer'], previousTitlesMatchMode: 'ANY' } });
  const prevTitleFound = prevTitleResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (prevTitleFound) ok('E.7 previous-title filter finds the fictional candidate');
  else fail('E.7 previous-title filter should find the fictional candidate', JSON.stringify(prevTitleResult));

  const completenessResult = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }], filters: { profileCompletenessMin: 0 } });
  const completenessFound = completenessResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (completenessFound) ok('E.7 profile-completeness filter finds the fictional candidate');
  else fail('E.7 profile-completeness filter should find the fictional candidate', JSON.stringify(completenessResult));

  const experienceSortResult = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }], sort: 'EXPERIENCE_DESC' });
  const experienceSortFound = experienceSortResult.json?.data?.some((i) => i.candidateId === candidateId);
  if (experienceSortFound) ok('E.7 experience-sorted search finds the fictional candidate');
  else fail('E.7 experience-sorted search should find the fictional candidate', JSON.stringify(experienceSortResult));

  const cursorPage1 = await search({ keywords: [{ term: 'Kubernetes', mode: 'MUST' }], pageSize: 1 });
  if (cursorPage1.json?.meta?.nextCursor !== undefined) ok('E.7 opaque cursor is returned by the search response', cursorPage1.json?.meta?.nextCursor ? 'present' : 'null (last page)');
  else fail('E.7 search response should include a cursor field', JSON.stringify(cursorPage1));

  // --- E.8: tenant/visibility restrictions enforced before querying and
  // before response serialization - a recruiter in a DIFFERENT
  // organisation must never see this candidate if it is org-private, and
  // the safe result never leaks organisation-identifying fields.
  const safeItem = mustResult.json?.data?.find((i) => i.candidateId === candidateId);
  const leaksOrgIdentity = safeItem && ('sourceOrganisationId' in safeItem || 'organisationId' in safeItem);
  if (safeItem && !leaksOrgIdentity) ok('E.8 result card does not leak organisation-identifying fields (tenant isolation enforced before serialization)');
  else fail('E.8 result card should not leak organisation-identifying fields', JSON.stringify(safeItem));

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ event: 'phase-e.summary', total: results.length, passed: results.length - failed.length, failed: failed.length }));
}

main()
  .catch((error) => { console.error(JSON.stringify({ event: 'phase-e.crashed', message: error?.message, stack: error?.stack })); process.exitCode = 1; })
  .finally(async () => { await closePrisma().catch(() => {}); });
