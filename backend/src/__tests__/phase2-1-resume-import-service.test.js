import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

let prisma;
let env;
let createResumeImportBatch;
let processResumeImportItem;
let confirmResumeImportItem;
let retryResumeImportItem;
let rejectResumeImportItem;
let getResumeImportFailureReport;

let state;
let idCounter = 1;
let originalStoragePath;

function clone(value) {
  if (value == null) return value;
  return structuredClone(value);
}

function now() {
  return new Date('2026-07-24T10:00:00.000Z');
}

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function bufferFromPdf(text) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 32 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.text(text);
    doc.end();
  });
}

function seedState() {
  state = {
    organisations: [
      { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'org-2', name: 'Beta', slug: 'beta', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    users: [
      { id: 'recruiter-1', email: 'recruiter@acme.com', role: 'RECRUITER', isActive: true, sessionVersion: 0 },
      { id: 'admin-1', email: 'admin@acme.com', role: 'ADMIN', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-1', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-2', organisationId: 'org-1', userId: 'admin-1', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    batches: [],
    items: [],
    backgroundTasks: [],
    candidates: [],
    resumeAssets: [],
    auditLogs: [],
  };
}

function actor(userId = 'recruiter-1') {
  return clone(state.users.find((item) => item.id === userId));
}

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR' && Array.isArray(value)) {
      return value.some((entry) => matchesWhere(row, entry));
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('not' in value) return row[key] !== value.not;
      if ('equals' in value) return String(row[key] || '').toLowerCase() === String(value.equals || '').toLowerCase();
      if ('contains' in value) return String(row[key] || '').toLowerCase().includes(String(value.contains || '').toLowerCase());
      if ('lte' in value) return row[key] != null && new Date(row[key]) <= new Date(value.lte);
      if ('gte' in value) return row[key] != null && new Date(row[key]) >= new Date(value.gte);
      return true;
    }
    return row[key] === value;
  });
}

function applyData(target, data = {}) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('increment' in value) {
        target[key] = (target[key] || 0) + value.increment;
        continue;
      }
    }
    target[key] = value;
  }
  target.updatedAt = now();
  return target;
}

function installPrismaMocks() {
  prisma.$transaction = async (callback) => callback(prisma);

  prisma.organisationMembership.findMany = async ({ where = {}, include = {} } = {}) => state.memberships
    .filter((item) => {
      if (where.userId && item.userId !== where.userId) return false;
      if (where.status && item.status !== where.status) return false;
      return true;
    })
    .map((item) => ({
      ...clone(item),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId)) : undefined,
    }));

  prisma.resumeImportBatch.create = async ({ data }) => {
    const batch = { id: nextId('batch'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.batches.push(batch);
    return clone(batch);
  };
  prisma.resumeImportBatch.update = async ({ where, data }) => {
    const batch = state.batches.find((item) => item.id === where.id);
    applyData(batch, clone(data));
    return clone(batch);
  };
  prisma.resumeImportBatch.findFirst = async ({ where = {} } = {}) => clone(state.batches.find((item) => matchesWhere(item, where)) || null);
  prisma.resumeImportBatch.findUnique = async ({ where = {}, select } = {}) => {
    const batch = state.batches.find((item) => item.id === where.id) || null;
    if (!batch) return null;
    if (!select) return clone(batch);
    return Object.fromEntries(Object.keys(select).map((key) => [key, batch[key] ?? null]));
  };
  prisma.resumeImportBatch.findMany = async ({ where = {} } = {}) => state.batches.filter((item) => matchesWhere(item, where)).map(clone);
  prisma.resumeImportBatch.count = async ({ where = {} } = {}) => state.batches.filter((item) => matchesWhere(item, where)).length;

  prisma.resumeImportItem.create = async ({ data }) => {
    const item = {
      id: nextId('item'),
      createdAt: now(),
      updatedAt: now(),
      retryCount: 0,
      requiresManualReview: false,
      duplicateResolution: 'PENDING',
      ...clone(data),
    };
    state.items.push(item);
    return clone(item);
  };
  prisma.resumeImportItem.update = async ({ where, data }) => {
    const item = state.items.find((entry) => entry.id === where.id);
    applyData(item, clone(data));
    return clone(item);
  };
  prisma.resumeImportItem.findUnique = async ({ where } = {}) => clone(state.items.find((item) => item.id === where.id) || null);
  prisma.resumeImportItem.findFirst = async ({ where = {} } = {}) => clone(state.items.find((item) => matchesWhere(item, where)) || null);
  prisma.resumeImportItem.findMany = async ({ where = {} } = {}) => state.items.filter((item) => matchesWhere(item, where)).map(clone);
  prisma.resumeImportItem.count = async ({ where = {} } = {}) => state.items.filter((item) => matchesWhere(item, where)).length;

  prisma.backgroundTask.create = async ({ data }) => {
    const duplicate = state.backgroundTasks.find((item) => item.idempotencyKey === data.idempotencyKey);
    if (duplicate) {
      const error = new Error('Duplicate');
      error.code = 'P2002';
      throw error;
    }
    const task = { id: nextId('task'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.backgroundTasks.push(task);
    return clone(task);
  };
  prisma.backgroundTask.findUnique = async ({ where } = {}) => clone(
    state.backgroundTasks.find((item) => item.id === where.id || item.idempotencyKey === where.idempotencyKey) || null
  );

  prisma.auditLog.create = async ({ data }) => {
    const auditLog = { id: nextId('audit'), createdAt: now(), ...clone(data) };
    state.auditLogs.push(auditLog);
    return clone(auditLog);
  };

  prisma.candidateProfile.findFirst = async ({ where = {} } = {}) => clone(state.candidates.find((item) => matchesWhere(item, where)) || null);
  prisma.candidateProfile.findUnique = async ({ where = {} } = {}) => clone(state.candidates.find((item) => item.id === where.id) || null);
  prisma.candidateProfile.findMany = async ({ where = {} } = {}) => state.candidates.filter((item) => matchesWhere(item, where)).map(clone);
  prisma.candidateProfile.create = async ({ data }) => {
    const candidate = { id: nextId('candidate'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.candidates.push(candidate);
    return clone(candidate);
  };
  prisma.candidateProfile.update = async ({ where, data }) => {
    const candidate = state.candidates.find((item) => item.id === where.id);
    applyData(candidate, clone(data));
    return clone(candidate);
  };

  prisma.resumeAsset.create = async ({ data }) => {
    const asset = { id: nextId('asset'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.resumeAssets.push(asset);
    return clone(asset);
  };
  prisma.resumeAsset.updateMany = async ({ where = {}, data }) => {
    state.resumeAssets
      .filter((item) => matchesWhere(item, where))
      .forEach((item) => applyData(item, clone(data)));
    return { count: state.resumeAssets.length };
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({
    createResumeImportBatch,
    processResumeImportItem,
    confirmResumeImportItem,
    retryResumeImportItem,
    rejectResumeImportItem,
    getResumeImportFailureReport,
  } = await import('../services/resumeImportService.js'));
});

beforeEach(() => {
  seedState();
  installPrismaMocks();
  originalStoragePath = env.localStoragePath;
  env.storageProvider = 'local';
  env.localStoragePath = '.tmp-resume-import-tests';
  env.aiResumeParsingEnabled = false;
  env.aiProvider = 'disabled';
  env.resumeImportMaxFiles = 100;
  env.resumeMaxFileSizeMb = 10;
  env.resumeImportMaxZipSizeMb = 100;
  env.resumeImportMaxUncompressedMb = 500;
  env.resumeImportMaxTextChars = 120000;
  env.resumeImportMaxRetries = 3;
  const fullPath = path.resolve(process.cwd(), env.localStoragePath);
  fs.rmSync(fullPath, { recursive: true, force: true });
});

afterEach(() => {
  const fullPath = path.resolve(process.cwd(), env.localStoragePath);
  fs.rmSync(fullPath, { recursive: true, force: true });
  env.localStoragePath = originalStoragePath;
});

test('valid multi-file upload creates a batch, items, stored files, and background tasks', async () => {
  const files = [
    {
      originalname: 'john-doe.pdf',
      mimetype: 'application/pdf',
      buffer: await bufferFromPdf('John Doe\njohn@example.com\n+1 555 010 0001'),
    },
    {
      originalname: 'jane-doe.pdf',
      mimetype: 'application/pdf',
      buffer: await bufferFromPdf('Jane Doe\njane@example.com\n+1 555 010 0002'),
    },
  ].map((file) => ({ ...file, size: file.buffer.length }));

  const batch = await createResumeImportBatch(actor(), files, 'org-1', { requestId: 'req-1' });

  assert.equal(batch.originalFileCount, 2);
  assert.equal(state.items.length, 2);
  assert.equal(state.backgroundTasks.length, 2);
  assert.equal(state.auditLogs.some((item) => item.action === 'resumeImport.batch.created'), true);
});

test('processing a successful resume item extracts text and leaves the item ready for review or import', async () => {
  const file = {
    originalname: 'candidate.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Candidate Ready\nready@example.com\n+1 555 999 0001'),
  };
  file.size = file.buffer.length;

  const batch = await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  await processResumeImportItem(item.id, 'worker-1');

  const updated = state.items.find((entry) => entry.id === item.id);
  assert.equal(updated.status, 'READY');
  assert.match(updated.extractedText, /ready@example.com/);
  assert.equal(updated.requiresManualReview, false);
  assert.equal(state.batches.find((entry) => entry.id === batch.id).processedCount, 1);
});

test('confirmation creates an imported candidate, while duplicate email detection requires review', async () => {
  const firstFile = {
    originalname: 'primary.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Primary Person\nprimary@example.com\n+1 555 000 1000'),
  };
  firstFile.size = firstFile.buffer.length;

  await createResumeImportBatch(actor(), [firstFile], 'org-1', {});
  await processResumeImportItem(state.items[0].id, 'worker-1');

  const confirmed = await confirmResumeImportItem(actor(), state.batches[0].id, state.items[0].id, {
    fullName: 'Primary Person',
    email: 'primary@example.com',
    phoneNumber: '+1 555 000 1000',
  }, 'org-1', {});

  assert.equal(confirmed.item.status, 'IMPORTED');
  assert.equal(state.candidates.length, 1);
  assert.equal(state.candidates[0].source, 'BULK_IMPORT');
  assert.equal(state.candidates[0].profileStatus, 'IMPORTED');
  assert.equal(state.resumeAssets.length, 1);

  const secondFile = {
    originalname: 'duplicate.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Duplicate Person\nprimary@example.com\n+1 555 000 2000'),
  };
  secondFile.size = secondFile.buffer.length;

  await createResumeImportBatch(actor(), [secondFile], 'org-1', {});
  const duplicateItem = state.items.find((item) => item.originalFilename === 'duplicate.pdf');
  await processResumeImportItem(duplicateItem.id, 'worker-2');

  assert.equal(state.items.find((item) => item.id === duplicateItem.id).status, 'DUPLICATE');
});

test('retry, rejection, and failure reporting operate on organisation-scoped items', async () => {
  state.batches.push({
    id: 'batch-manual',
    organisationId: 'org-1',
    createdByUserId: 'recruiter-1',
    originalFileCount: 1,
    totalItemCount: 1,
    processedCount: 1,
    successCount: 0,
    duplicateCount: 0,
    reviewCount: 0,
    failedCount: 1,
    status: 'FAILED',
    createdAt: now(),
    updatedAt: now(),
  });
  state.items.push({
    id: 'item-failed',
    batchId: 'batch-manual',
    organisationId: 'org-1',
    originalFilename: 'failed.pdf',
    sanitizedFilename: 'failed.pdf',
    storedObjectKey: 'resumes/test/failed.pdf',
    storageProvider: 'local',
    mimeType: 'application/pdf',
    fileExtension: '.pdf',
    fileSizeBytes: 1,
    status: 'FAILED',
    retryCount: 0,
    errorCode: 'AI_TIMEOUT',
    errorMessage: 'Timed out',
    createdAt: now(),
    updatedAt: now(),
  });

  const retried = await retryResumeImportItem(actor(), 'batch-manual', 'item-failed', { force: false }, 'org-1', {});
  assert.equal(retried.status, 'QUEUED');
  assert.equal(state.backgroundTasks.length >= 1, true);

  const rejected = await rejectResumeImportItem(actor(), 'batch-manual', 'item-failed', { reviewNotes: 'Reject invalid resume' }, 'org-1', {});
  assert.equal(rejected.status, 'CANCELLED');

  const report = await getResumeImportFailureReport(actor(), 'batch-manual', 'org-1');
  assert.match(report.body, /failed\.pdf/);
  assert.match(report.body, /CANCELLED/);
});
