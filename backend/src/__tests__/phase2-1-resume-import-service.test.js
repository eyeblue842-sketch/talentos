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
let processBackgroundTask;
let resetIntelligenceProvider;
let resetDocumentProcessorCircuitBreaker;
const originalFetch = global.fetch;

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

function scaffoldCanonicalDocument(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    parserVersion: 'document-processor-0.1.0',
    correlationId: 'corr-import-1',
    engineVersions: { docling: '2.119.0', paddleocr: null },
    selectedRoute: 'DOCLING_STRUCTURE',
    fallbackReasons: [],
    documentMetadata: {
      pageCount: 1,
      fileSizeBytes: 10,
      mimeType: 'application/pdf',
      sniffedMimeType: 'application/pdf',
      originalFilename: 'candidate.pdf',
    },
    pages: [{ pageNumber: 1, nativeTextPresent: true }],
    textBlocks: [
      {
        page: 1,
        text: 'Processor Person\nprocessor@example.com\n+1 555 999 0101',
        readingOrder: 1,
        engine: 'docling',
        engineConfidence: 0.98,
      },
    ],
    tables: [],
    images: [],
    readingOrderApplied: true,
    extractionConfidence: 0.96,
    qualityWarnings: [],
    processingDurations: { totalMs: 12, validationMs: 2, extractionMs: 10 },
    error: null,
    preprocessing: [],
    ocrTextBlocks: [],
    ocrPages: [],
    reconciliation: [],
    ...overrides,
  };
}

function readyResponse(doclingState = 'READY') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'ready',
      engines: { paddleocr: { available: true, reason: null, version: '3.7.0' } },
      docling: {
        state: doclingState,
        engineVersion: '2.119.0',
        degradedReason: null,
        activeConversions: 0,
        queuedRequests: 0,
        queueCapacity: 2,
      },
      preprocessing: { available: true, version: '1.0.0', reason: null },
      ocr: {
        state: 'READY',
        engineVersion: '3.7.0',
        degradedReason: null,
        activeConversions: 0,
        queuedRequests: 0,
        queueCapacity: 2,
      },
      activeRequests: 0,
      maxConcurrentRequests: 2,
    }),
  };
}

function mockDocumentProcessor(postHandler, { doclingState = 'READY' } = {}) {
  return async (url, init) => {
    if (String(url).endsWith('/health/ready')) {
      return readyResponse(doclingState);
    }
    return postHandler(url, init);
  };
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
      if ('notIn' in value) return !value.notIn.includes(row[key]);
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
  prisma.resumeImportItem.updateMany = async ({ where = {}, data }) => {
    const matches = state.items.filter((item) => matchesWhere(item, where));
    matches.forEach((item) => applyData(item, clone(data)));
    return { count: matches.length };
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
    const task = { id: nextId('task'), createdAt: now(), updatedAt: now(), attemptCount: 0, ...clone(data) };
    state.backgroundTasks.push(task);
    return clone(task);
  };
  prisma.backgroundTask.findUnique = async ({ where } = {}) => clone(
    state.backgroundTasks.find((item) => item.id === where.id || item.idempotencyKey === where.idempotencyKey) || null
  );
  prisma.backgroundTask.findFirst = async ({ where = {}, orderBy } = {}) => {
    const matches = state.backgroundTasks.filter((item) => matchesWhere(item, where));
    if (orderBy?.createdAt === 'desc') matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return clone(matches[0] || null);
  };
  prisma.backgroundTask.update = async ({ where, data }) => {
    const task = state.backgroundTasks.find((item) => item.id === where.id);
    applyData(task, clone(data));
    return clone(task);
  };
  prisma.backgroundTask.updateMany = async ({ where = {}, data }) => {
    const matches = state.backgroundTasks.filter((item) => matchesWhere(item, where));
    matches.forEach((item) => applyData(item, clone(data)));
    return { count: matches.length };
  };

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
  ({ processBackgroundTask } = await import('../services/backgroundTaskHandlers.js'));
  ({ resetIntelligenceProvider } = await import('../intelligence/services/providerService.js'));
  ({ resetDocumentProcessorCircuitBreaker } = await import('../services/documentProcessor/documentProcessorClient.js'));
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
  env.resumeImportBlockedBatchIds = [];
  env.documentProcessorEnabled = false;
  env.documentProcessorIntegrationEnabled = false;
  env.documentProcessorAllowedBatchIds = [];
  env.documentProcessorAllowedCompanyIds = [];
  env.documentProcessorUrl = 'http://127.0.0.1:8081';
  env.documentProcessorConnectTimeoutMs = 50;
  env.documentProcessorResponseTimeoutMs = 50;
  env.documentProcessorMaxRetries = 1;
  env.documentProcessorCircuitBreakerThreshold = 3;
  env.documentProcessorCircuitBreakerCooldownMs = 1000;
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  env.intelligenceModel = null;
  env.intelligenceBaseUrl = 'https://example.test';
  env.intelligenceApiKey = 'test-key';
  resetIntelligenceProvider();
  resetDocumentProcessorCircuitBreaker();
  const fullPath = path.resolve(process.cwd(), env.localStoragePath);
  fs.rmSync(fullPath, { recursive: true, force: true });
  global.fetch = originalFetch;
});

afterEach(() => {
  const fullPath = path.resolve(process.cwd(), env.localStoragePath);
  fs.rmSync(fullPath, { recursive: true, force: true });
  env.localStoragePath = originalStoragePath;
  global.fetch = originalFetch;
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

test('processResumeImportItem skips blocked batches before any processing state changes', async () => {
  const file = {
    originalname: 'blocked.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Blocked Candidate\nblocked@example.com\n+1 555 999 0002'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  const originalStatus = item.status;
  env.resumeImportBlockedBatchIds = [item.batchId];

  const result = await processResumeImportItem(item.id, 'worker-guard');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(result, 'cancelled');
  assert.equal(updated.status, originalStatus);
  assert.equal(updated.processingStartedAt ?? null, null);
  assert.equal(updated.processingCompletedAt ?? null, null);
  assert.equal(updated.extractedText ?? null, null);
});

test('processResumeImportItem preserves the existing deterministic-only path when document processor integration is disabled', async () => {
  const file = {
    originalname: 'disabled-path.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Deterministic Person\ndeterministic@example.com\n+1 555 999 0004'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('document processor should not be called');
  };

  await processResumeImportItem(item.id, 'worker-disabled');

  const updated = state.items.find((entry) => entry.id === item.id);
  assert.equal(updated.status, 'READY');
  assert.equal(fetchCalled, false);
  assert.equal(updated.metadata.documentProcessor.used, false);
  assert.equal(updated.metadata.documentProcessor.attempted, false);
  assert.match(updated.extractedText, /deterministic@example.com/);
});

test('an allowlisted batch calls the document processor and persists hybrid reconciliation metadata', async () => {
  const file = {
    originalname: 'processor.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Processor Person\nprocessor@example.com\n+1 555 999 0101'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  let analyseCalls = 0;
  global.fetch = mockDocumentProcessor(async (url) => {
    analyseCalls += 1;
    assert.equal(String(url), 'http://127.0.0.1:8081/v1/documents/analyse');
    return {
      ok: true,
      status: 200,
      json: async () => scaffoldCanonicalDocument(),
    };
  });

  await processResumeImportItem(item.id, 'worker-hybrid');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(analyseCalls, 1);
  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.used, true);
  assert.equal(updated.metadata.documentProcessor.rolloutMatched, true);
  assert.equal(updated.metadata.documentProcessor.selectedRoute, 'DOCLING_STRUCTURE');
  assert.equal(updated.parsedData.metadata.documentProcessor.used, true);
  assert.equal(updated.parsedData.metadata.reconciliation.reviewRequired, false);
  assert.equal(updated.parsedData.candidate.email.alternatives.pythonExtracted.value, 'processor@example.com');
  assert.equal(updated.parsedData.candidate.email.alternatives.deterministic.value, 'processor@example.com');
  assert.equal(updated.parsedData.candidate.email.value, 'processor@example.com');
  assert.equal(updated.parsedData.candidate.email.source, 'document_processor');
  assert.equal(updated.parsedData.candidate.email.evidence.page, 1);
});

test('a non-allowlisted batch does not call the document processor even when integration is enabled', async () => {
  const file = {
    originalname: 'not-allowlisted.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('No Processor\nnoprocessor@example.com\n+1 555 999 0005'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = ['fictional-batch-only'];

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('should not be called');
  };

  await processResumeImportItem(item.id, 'worker-not-allowlisted');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(fetchCalled, false);
  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.attempted, false);
  assert.equal(updated.metadata.documentProcessor.rolloutMatched, false);
});

test('integration enabled without any batch or company allowlist keeps the legacy parser path unchanged', async () => {
  const file = {
    originalname: 'no-allowlist.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Legacy Only\nlegacy.only@example.com\n+1 555 999 1010'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [];
  env.documentProcessorAllowedCompanyIds = [];

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('should not be called without an allowlist');
  };

  await processResumeImportItem(item.id, 'worker-no-allowlist');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(fetchCalled, false);
  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.used, false);
  assert.equal(updated.metadata.documentProcessor.attempted, false);
  assert.equal(updated.metadata.documentProcessor.rolloutMatched, false);
  assert.match(updated.extractedText, /legacy\.only@example\.com/);
});

test('an allowlisted organisation can invoke the document processor even when the batch is not explicitly allowlisted', async () => {
  const file = {
    originalname: 'company-allowlisted.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Company Allowlisted\ncompany.allowlisted@example.com\n+1 555 999 0008'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedCompanyIds = ['org-1'];

  let analyseCalls = 0;
  global.fetch = mockDocumentProcessor(async () => {
    analyseCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => scaffoldCanonicalDocument({
        correlationId: 'corr-company-allow',
        textBlocks: [{
          page: 1,
          text: 'Company Allowlisted\ncompany.allowlisted@example.com\n+1 555 999 0008',
          readingOrder: 1,
          engine: 'docling',
          engineConfidence: 0.98,
        }],
      }),
    };
  });

  await processResumeImportItem(item.id, 'worker-company-allow');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(analyseCalls, 1);
  assert.equal(updated.metadata.documentProcessor.used, true);
  assert.equal(updated.metadata.documentProcessor.rolloutMatched, true);
});

test('document processor partial-page warnings preserve usable text and route the item to review', async () => {
  const file = {
    originalname: 'partial.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Legacy Partial\nlegacy.partial@example.com\n+1 555 999 0006'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({
      documentMetadata: {
        pageCount: 2,
        fileSizeBytes: 10,
        mimeType: 'application/pdf',
        sniffedMimeType: 'application/pdf',
        originalFilename: 'partial.pdf',
      },
      pages: [{ pageNumber: 1, nativeTextPresent: true }, { pageNumber: 2, nativeTextPresent: false }],
      textBlocks: [{
        page: 1,
        text: 'Partial Person\npartial@example.com\n+1 555 999 1000',
        readingOrder: 1,
        engine: 'docling',
        engineConfidence: 0.95,
      }],
      ocrPages: [{
        pageNumber: 2,
        sourceType: 'PDF_RENDERED',
        extractionRoute: 'OCR_RENDERED_PDF_PAGE',
        lowConfidence: false,
        emptyOutput: true,
        warnings: ['PAGE_RENDER_FAILED'],
        meanConfidence: null,
        orientation: null,
      }],
      qualityWarnings: ['partial_page_failure'],
    }),
  }));

  await processResumeImportItem(item.id, 'worker-partial');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.requiresManualReview, true);
  assert.equal(updated.metadata.documentProcessor.used, true);
  assert.equal(updated.parsedData.metadata.documentProcessor.document.failedPageCount, 1);
  assert.match(updated.extractedText, /partial@example.com/);
});

test('a document processor connection failure falls back to deterministic parsing and records the fallback reason', async () => {
  const file = {
    originalname: 'processor-fallback.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Fallback Person\nfallback.person@example.com\n+1 555 999 0007'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => {
    throw new Error('ECONNREFUSED');
  });

  await processResumeImportItem(item.id, 'worker-fallback');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.used, false);
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_CONNECTION_ERROR');
  assert.match(updated.extractedText, /fallback\.person@example\.com/);
});

test('a document processor 4xx rejection falls back to deterministic parsing and persists the structured fallback reason', async () => {
  const file = {
    originalname: 'processor-4xx.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Client Reject\nclient.reject@example.com\n+1 555 999 0009'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: false,
    status: 422,
    json: async () => ({ code: 'UNSUPPORTED_MIME_TYPE', message: 'bad mime', retryable: false }),
  }));

  await processResumeImportItem(item.id, 'worker-4xx');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.used, false);
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'UNSUPPORTED_MIME_TYPE');
  assert.equal(updated.metadata.documentProcessor.retryable, false);
});

test('a document processor 5xx rejection falls back to deterministic parsing and persists the retryable fallback reason', async () => {
  const file = {
    originalname: 'processor-5xx.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Server Retry\nserver.retry@example.com\n+1 555 999 0010'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: false,
    status: 503,
    json: async () => ({ code: 'SERVICE_BUSY', message: 'busy', retryable: true }),
  }));

  await processResumeImportItem(item.id, 'worker-5xx');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.used, false);
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'SERVICE_BUSY');
  assert.equal(updated.metadata.documentProcessor.retryable, true);
});

test('a malformed document processor response falls back to deterministic parsing and persists the invalid-response reason', async () => {
  const file = {
    originalname: 'processor-malformed.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Malformed Response\nmalformed.response@example.com\n+1 555 999 0011'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error('Unexpected token in JSON');
    },
  }));

  await processResumeImportItem(item.id, 'worker-malformed');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_INVALID_RESPONSE');
});

test('an unsupported schema version falls back safely and persists the schema mismatch reason', async () => {
  const file = {
    originalname: 'processor-schema.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Schema Mismatch\nschema.mismatch@example.com\n+1 555 999 0012'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({ schemaVersion: '99.0.0' }),
  }));

  await processResumeImportItem(item.id, 'worker-schema');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'READY');
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_SCHEMA_MISMATCH');
});

test('an invalid page reference falls back safely and routes the item to review', async () => {
  const file = {
    originalname: 'processor-bad-page.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Bad Page\nbad.page@example.com\n+1 555 999 0013'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({
      pages: [{ pageNumber: 1, nativeTextPresent: true }],
      textBlocks: [{
        page: 2,
        text: 'Impossible page reference',
        readingOrder: 1,
        engine: 'docling',
        engineConfidence: 0.95,
      }],
    }),
  }));

  await processResumeImportItem(item.id, 'worker-bad-page');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.requiresManualReview, true);
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_INVALID_PAGE_REFERENCE');
});

test('an invalid confidence falls back safely and routes the item to review', async () => {
  const file = {
    originalname: 'processor-bad-confidence.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Bad Confidence\nbad.confidence@example.com\n+1 555 999 0014'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({
      extractionConfidence: 1.5,
    }),
  }));

  await processResumeImportItem(item.id, 'worker-bad-confidence');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.requiresManualReview, true);
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_INVALID_CONFIDENCE');
});

test('all-pages failure without usable legacy text routes the item to review rather than persisting success', async () => {
  const file = {
    originalname: 'all-pages-failed.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf(null),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({
      textBlocks: [],
      ocrTextBlocks: [],
      ocrPages: [{
        pageNumber: 1,
        sourceType: 'PDF_RENDERED',
        extractionRoute: 'OCR_RENDERED_PDF_PAGE',
        lowConfidence: true,
        emptyOutput: true,
        warnings: ['ALL_PAGES_FAILED'],
        meanConfidence: null,
        orientation: null,
      }],
    }),
  }));

  await processResumeImportItem(item.id, 'worker-all-pages-failed');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.requiresManualReview, true);
  assert.equal(updated.extractedText, '');
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_EMPTY_OUTPUT');
});

test('empty Python output with usable legacy text falls back audibly, preserves the deterministic result, and remains reviewable', async () => {
  const file = {
    originalname: 'empty-output-fallback.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Legacy Empty Output\nlegacy.empty@example.com\n+1 555 999 0015'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({
      textBlocks: [],
      pages: [{ pageNumber: 1, nativeTextPresent: false }],
    }),
  }));

  await processResumeImportItem(item.id, 'worker-empty-output');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.requiresManualReview, true);
  assert.match(updated.extractedText, /legacy\.empty@example\.com/);
  assert.equal(updated.metadata.documentProcessor.fallbackReason, 'DOCUMENT_PROCESSOR_EMPTY_OUTPUT');
});

test('deterministic and Python disagreement remains available for review instead of silently overwriting the stronger value', async () => {
  const file = {
    originalname: 'processor-disagreement.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Legacy Winner\nlegacy.winner@example.com\n+1 555 999 0016'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];

  global.fetch = mockDocumentProcessor(async () => ({
    ok: true,
    status: 200,
    json: async () => scaffoldCanonicalDocument({
      textBlocks: [{
        page: 1,
        text: 'Processor Challenger\nprocessor.challenger@example.com\n+1 555 999 0016',
        readingOrder: 1,
        engine: 'docling',
        engineConfidence: 0.95,
      }],
    }),
  }));

  await processResumeImportItem(item.id, 'worker-disagreement');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.requiresManualReview, true);
  assert.equal(updated.parsedData.candidate.email.alternatives.deterministic.value, 'legacy.winner@example.com');
  assert.equal(updated.parsedData.candidate.email.alternatives.pythonExtracted.value, 'processor.challenger@example.com');
  assert.equal(updated.parsedData.metadata.reconciliation.reviewRequired, true);
});

test('AI may fill a missing field only when the value is supported by document text evidence', async () => {
  const file = {
    originalname: 'processor-ai-supported.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Evidence Person\nevidence.person@example.com\nBackend engineer building APIs.'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  resetIntelligenceProvider();

  global.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/health/ready')) {
      return readyResponse('READY');
    }
    if (target === 'http://127.0.0.1:8081/v1/documents/analyse') {
      return {
        ok: true,
        status: 200,
        json: async () => scaffoldCanonicalDocument({
          textBlocks: [{
            page: 1,
            text: 'Evidence Person\nevidence.person@example.com\nBackend engineer building APIs.',
            readingOrder: 1,
            engine: 'docling',
            engineConfidence: 0.98,
          }],
        }),
      };
    }
    return {
      ok: true,
      text: async () => JSON.stringify({
        model: 'gpt-test',
        choices: [{
          message: {
            content: JSON.stringify({
              candidate: {
                summary: { value: 'Backend engineer building APIs.', confidence: 0.86, source: 'ai' },
              },
              metadata: { parser: 'ai-test' },
            }),
          },
        }],
      }),
    };
  };

  await processResumeImportItem(item.id, 'worker-ai-supported');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'READY');
  assert.equal(updated.parsedData.candidate.summary.value, 'Backend engineer building APIs.');
  assert.equal(updated.parsedData.candidate.summary.source, 'ai_with_text_evidence');
});

test('unsupported AI-only values on a review-sensitive field are rejected and propagated as review warnings instead of becoming selected candidate data', async () => {
  const file = {
    originalname: 'processor-ai-unsupported.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Unsupported AI\nunsupported.ai@example.com'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [item.batchId];
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  resetIntelligenceProvider();

  global.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/health/ready')) {
      return readyResponse('READY');
    }
    if (target === 'http://127.0.0.1:8081/v1/documents/analyse') {
      return {
        ok: true,
        status: 200,
        json: async () => scaffoldCanonicalDocument({
          textBlocks: [{
            page: 1,
            text: 'Unsupported AI\nunsupported.ai@example.com',
            readingOrder: 1,
            engine: 'docling',
            engineConfidence: 0.98,
          }],
        }),
      };
    }
    return {
      ok: true,
      text: async () => JSON.stringify({
        model: 'gpt-test',
        choices: [{
          message: {
            content: JSON.stringify({
              candidate: {
                currentTitle: { value: 'Invented Principal Architect', confidence: 0.91, source: 'ai' },
              },
              metadata: { parser: 'ai-test' },
            }),
          },
        }],
      }),
    };
  };

  await processResumeImportItem(item.id, 'worker-ai-unsupported');
  const updated = state.items.find((entry) => entry.id === item.id);

  assert.equal(updated.status, 'REVIEW_REQUIRED');
  assert.equal(updated.parsedData.candidate.currentTitle.value, null);
  assert.match(JSON.stringify(updated.parsedData.metadata.reconciliation.warnings), /rejected unsupported AI-only value/i);
});

test('resume import background task is cancelled for a blocked batch before processResumeImportItem runs', async () => {
  const file = {
    originalname: 'guarded.pdf',
    mimetype: 'application/pdf',
    buffer: await bufferFromPdf('Guarded Candidate\nguarded@example.com\n+1 555 999 0003'),
  };
  file.size = file.buffer.length;

  await createResumeImportBatch(actor(), [file], 'org-1', {});
  const item = state.items[0];
  const originalStatus = item.status;
  env.resumeImportBlockedBatchIds = [item.batchId];
  const task = state.backgroundTasks[0];
  task.status = 'RUNNING';
  task.leaseOwnerId = 'worker-guard';
  task.entityId = item.id;
  task.payload = { itemId: item.id };

  const result = await processBackgroundTask(task);
  const updatedItem = state.items.find((entry) => entry.id === item.id);
  const updatedTask = state.backgroundTasks.find((entry) => entry.id === task.id);

  assert.equal(result, 'cancelled');
  assert.equal(updatedItem.status, originalStatus);
  assert.equal(updatedTask.status, 'CANCELLED');
  assert.match(updatedTask.lastErrorMessage, /blocked by configuration/i);
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
