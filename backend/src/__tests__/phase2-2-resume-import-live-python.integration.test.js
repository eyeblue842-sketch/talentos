import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { storePrivateFile } from '../config/storage.js';
import { processResumeImportItem } from '../services/resumeImportService.js';

const RUN = `phase2live${Date.now()}`;
const DOC_PROCESSOR_URL = process.env.PHASE2_DOC_PROCESSOR_URL || 'http://127.0.0.1:18081';

// Same explicit opt-in gate as resume-search-v2-opensearch.integration.test.js:
// off by default (test.skip) so the normal deterministic backend suite
// never depends on a live document-processor instance being reachable.
// Only the two tests below that make real, un-mocked network calls through
// to DOC_PROCESSOR_URL need this - the third test in this file fully mocks
// global.fetch itself and stays a plain, always-run test.
const runIntegration = process.env.PHASE2_LIVE_PYTHON_INTEGRATION_ENABLED === 'true';
const integrationTest = runIntegration ? test : test.skip;
const originalFetch = global.fetch;
const originalStorageProvider = env.storageProvider;
const originalLocalStoragePath = env.localStoragePath;
const originalDocumentProcessorEnabled = env.documentProcessorEnabled;
const originalIntegrationEnabled = env.documentProcessorIntegrationEnabled;
const originalAllowedBatchIds = env.documentProcessorAllowedBatchIds;
const originalAllowedCompanyIds = env.documentProcessorAllowedCompanyIds;
const originalAiResumeParsingEnabled = env.aiResumeParsingEnabled;
const originalAiProvider = env.aiProvider;
const originalIntelligenceEnabled = env.intelligenceEnabled;
const originalIntelligenceProvider = env.intelligenceProvider;
const originalIntelligenceModel = env.intelligenceModel;
const originalDocumentProcessorUrl = env.documentProcessorUrl;

let org;
let user;
let createdBatchIds = [];
let createdItemIds = [];
let createdStorageKeys = [];

function testStorageRoot() {
  return path.resolve(process.cwd(), '.tmp-phase2-live-python');
}

function resetRuntimeEnv() {
  env.storageProvider = 'local';
  env.localStoragePath = '.tmp-phase2-live-python';
  env.documentProcessorEnabled = true;
  env.documentProcessorIntegrationEnabled = true;
  env.documentProcessorAllowedBatchIds = [];
  env.documentProcessorAllowedCompanyIds = [];
  env.documentProcessorUrl = DOC_PROCESSOR_URL;
  env.documentProcessorConnectTimeoutMs = 3000;
  env.documentProcessorResponseTimeoutMs = 120000;
  env.documentProcessorMaxRetries = 0;
  env.aiResumeParsingEnabled = false;
  env.aiProvider = 'disabled';
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  env.intelligenceModel = null;
}

function restoreRuntimeEnv() {
  env.storageProvider = originalStorageProvider;
  env.localStoragePath = originalLocalStoragePath;
  env.documentProcessorEnabled = originalDocumentProcessorEnabled;
  env.documentProcessorIntegrationEnabled = originalIntegrationEnabled;
  env.documentProcessorAllowedBatchIds = originalAllowedBatchIds;
  env.documentProcessorAllowedCompanyIds = originalAllowedCompanyIds;
  env.aiResumeParsingEnabled = originalAiResumeParsingEnabled;
  env.aiProvider = originalAiProvider;
  env.intelligenceEnabled = originalIntelligenceEnabled;
  env.intelligenceProvider = originalIntelligenceProvider;
  env.intelligenceModel = originalIntelligenceModel;
  env.documentProcessorUrl = originalDocumentProcessorUrl;
}

async function bufferFromPdf(lines) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 32 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    for (const line of lines) {
      doc.text(line);
      doc.moveDown(0.35);
    }
    doc.end();
  });
}

async function createImportItem(lines, { batchId, organisationId, filename }) {
  const buffer = await bufferFromPdf(lines);
  const stored = await storePrivateFile({
    originalname: filename,
    mimetype: 'application/pdf',
    buffer,
    size: buffer.length,
  }, { prefix: `phase2-live/${RUN}` });

  createdStorageKeys.push(stored.storageKey);

  const item = await prisma.resumeImportItem.create({
    data: {
      batchId,
      organisationId,
      originalFilename: filename,
      sanitizedFilename: filename.toLowerCase(),
      storedObjectKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      fileSizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256,
      status: 'UPLOADED',
    },
  });

  createdItemIds.push(item.id);
  return item;
}

before(async () => {
  org = await prisma.organisation.create({
    data: { name: `Phase2 Live Python ${RUN}`, slug: `phase2-live-python-${RUN}` },
  });
  user = await prisma.user.create({
    data: {
      email: `${RUN}@example.test`,
      passwordHash: 'not-a-real-hash',
      role: 'RECRUITER',
    },
  });
});

beforeEach(() => {
  resetRuntimeEnv();
  global.fetch = originalFetch;
  createdBatchIds = [];
  createdItemIds = [];
  createdStorageKeys = [];
  fs.rmSync(testStorageRoot(), { recursive: true, force: true });
});

after(async () => {
  global.fetch = originalFetch;
  restoreRuntimeEnv();
  fs.rmSync(testStorageRoot(), { recursive: true, force: true });
  if (org?.id) {
    await prisma.backgroundTask.deleteMany({ where: { organisationId: org.id } });
    await prisma.resumeImportItem.deleteMany({ where: { organisationId: org.id } });
    await prisma.resumeImportBatch.deleteMany({ where: { organisationId: org.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.organisation.deleteMany({ where: { id: org.id } });
  }
});

integrationTest('processResumeImportItem calls the live Python service and persists the reconciliation payload after a real Prisma reload', async () => {
  const batch = await prisma.resumeImportBatch.create({
    data: {
      organisationId: org.id,
      createdByUserId: user.id,
      originalFileCount: 1,
      totalItemCount: 1,
      status: 'PROCESSING',
    },
  });
  createdBatchIds.push(batch.id);
  env.documentProcessorAllowedBatchIds = [batch.id];

  const item = await createImportItem([
    'Fictional Live Processor',
    'fictional.live.processor@example.test',
    '+1 555 321 7788',
    'Senior Platform Engineer',
    'Bengaluru, Karnataka, India',
    'Backend engineer building hiring systems.',
  ], {
    batchId: batch.id,
    organisationId: org.id,
    filename: 'fictional-live-processor.pdf',
  });

  const original = global.fetch;
  const observed = { postCalls: 0, lastCorrelationId: null };
  global.fetch = async (url, init) => {
    const target = String(url);
    if (target.endsWith('/v1/documents/analyse')) {
      observed.postCalls += 1;
      const formData = init?.body;
      if (formData?.get) {
        observed.lastCorrelationId = formData.get('correlationId');
      }
    }
    return original(url, init);
  };

  const result = await processResumeImportItem(item.id, 'worker-live-python');
  assert.equal(result, 'success');

  const reloaded = await prisma.resumeImportItem.findUnique({ where: { id: item.id } });
  assert.ok(reloaded);
  assert.equal(observed.postCalls, 1);
  assert.ok(observed.lastCorrelationId);
  assert.equal(reloaded.status, 'REVIEW_REQUIRED');
  assert.equal(reloaded.requiresManualReview, true);
  assert.equal(reloaded.metadata.documentProcessor.used, true);
  assert.equal(reloaded.metadata.documentProcessor.correlationId, observed.lastCorrelationId);
  assert.ok(reloaded.metadata.documentProcessor.selectedRoute);
  assert.equal(Number(reloaded.metadata.documentProcessor.document.pageCount) >= 1, true);
  assert.equal(reloaded.parsedData.candidate.email.value, 'fictional.live.processor@example.test');
  assert.ok(reloaded.parsedData.candidate.email.evidence);
  assert.equal(reloaded.parsedData.candidate.email.evidence.page, 1);
  assert.equal(reloaded.parsedData.candidate.email.alternatives.deterministic.value, 'fictional.live.processor@example.test');
  assert.equal(reloaded.parsedData.candidate.email.alternatives.pythonExtracted.value, 'fictional.live.processor@example.test');
  assert.equal(reloaded.parsedData.candidate.email.reconciliationReason, 'processor_deterministic_agreement');
  assert.equal(Array.isArray(reloaded.metadata.documentProcessor.document.ocrPages), true);

  const secondPass = await processResumeImportItem(item.id, 'worker-live-python-repeat');
  const reloadedAgain = await prisma.resumeImportItem.findUnique({ where: { id: item.id } });
  assert.equal(secondPass, 'cancelled');
  assert.equal(reloadedAgain.updatedAt.getTime(), reloaded.updatedAt.getTime());
});

integrationTest('concurrent processResumeImportItem calls for the same real row perform exactly one live Python request and one final persistence', async () => {
  const batch = await prisma.resumeImportBatch.create({
    data: {
      organisationId: org.id,
      createdByUserId: user.id,
      originalFileCount: 1,
      totalItemCount: 1,
      status: 'PROCESSING',
    },
  });
  createdBatchIds.push(batch.id);
  env.documentProcessorAllowedBatchIds = [batch.id];

  const item = await createImportItem([
    'Concurrent Fictional Processor',
    'concurrent.processor@example.test',
    '+1 555 000 4455',
    'Platform Engineer',
  ], {
    batchId: batch.id,
    organisationId: org.id,
    filename: 'concurrent-fictional-processor.pdf',
  });

  const original = global.fetch;
  const observed = { postCalls: 0 };
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/v1/documents/analyse')) {
      observed.postCalls += 1;
    }
    return original(url, init);
  };

  const [first, second] = await Promise.all([
    processResumeImportItem(item.id, 'worker-live-a'),
    processResumeImportItem(item.id, 'worker-live-b'),
  ]);

  const reloaded = await prisma.resumeImportItem.findUnique({ where: { id: item.id } });
  assert.deepEqual(new Set([first, second]), new Set(['success', 'cancelled']));
  assert.equal(observed.postCalls, 1);
  assert.equal(reloaded.status, 'REVIEW_REQUIRED');
  assert.equal(reloaded.metadata.documentProcessor.used, true);
  assert.equal(reloaded.parsedData.candidate.email.value, 'concurrent.processor@example.test');
});

test('a persisted hybrid reconciliation payload survives a real Prisma reload with alternatives, evidence, warnings, and failed-page metadata intact', async () => {
  const batch = await prisma.resumeImportBatch.create({
    data: {
      organisationId: org.id,
      createdByUserId: user.id,
      originalFileCount: 1,
      totalItemCount: 1,
      status: 'PROCESSING',
    },
  });
  createdBatchIds.push(batch.id);
  env.documentProcessorAllowedBatchIds = [batch.id];
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-phase2-test';
  env.intelligenceBaseUrl = 'https://example.test';
  env.intelligenceApiKey = 'test-key';

  const item = await createImportItem([
    'Legacy Persistence Person',
    'legacy.persistence@example.test',
    '+1 555 222 8888',
    'Backend Engineer',
    'Pune, Maharashtra, India',
  ], {
    batchId: batch.id,
    organisationId: org.id,
    filename: 'fictional-persistence-roundtrip.pdf',
  });

  global.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/health/ready')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ready',
          engines: { paddleocr: { available: true, reason: null, version: '3.7.0' } },
          docling: {
            state: 'READY',
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

    if (target.endsWith('/v1/documents/analyse')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: '1.0.0',
          parserVersion: 'document-processor-0.1.0',
          correlationId: 'corr-persistence-roundtrip',
          engineVersions: { docling: '2.119.0', paddleocr: '3.7.0' },
          selectedRoute: 'HYBRID_RECONCILED',
          fallbackReasons: [],
          documentMetadata: {
            pageCount: 2,
            fileSizeBytes: 1234,
            mimeType: 'application/pdf',
            sniffedMimeType: 'application/pdf',
            originalFilename: 'fictional-persistence-roundtrip.pdf',
          },
          pages: [
            { pageNumber: 1, nativeTextPresent: true },
            { pageNumber: 2, nativeTextPresent: false },
          ],
          textBlocks: [
            {
              page: 1,
              text: 'Processor Persistence Person\nlegacy.persistence@example.test\nSenior Platform Engineer\nPune, Maharashtra, India\nBuilt resilient hiring APIs.',
              readingOrder: 1,
              engine: 'docling',
              engineConfidence: 0.97,
              extractionRoute: 'DOCLING_STRUCTURE',
              sourceType: 'PDF_NATIVE',
              boundingBox: { x: 10, y: 10, width: 200, height: 50 },
            },
          ],
          tables: [],
          images: [],
          readingOrderApplied: true,
          extractionConfidence: 0.91,
          qualityWarnings: ['partial_page_failure'],
          processingDurations: { totalMs: 45, validationMs: 5, extractionMs: 40 },
          error: null,
          preprocessing: [
            {
              pageNumber: 2,
              sourceType: 'PDF_RENDERED',
              plannedRoute: 'OCR_RENDERED_PDF_PAGE',
              textQuality: 'LOW',
              warnings: ['PAGE_RENDER_FAILED'],
              qualityDecision: 'REVIEW_REQUIRED',
            },
          ],
          ocrTextBlocks: [],
          ocrPages: [
            {
              pageNumber: 2,
              sourceType: 'PDF_RENDERED',
              extractionRoute: 'OCR_RENDERED_PDF_PAGE',
              lowConfidence: true,
              emptyOutput: true,
              warnings: ['PAGE_RENDER_FAILED'],
              meanConfidence: null,
              orientation: null,
            },
          ],
          reconciliation: [
            {
              page: 1,
              decision: 'NATIVE_TEXT_USED',
              reason: 'native_text_quality_good',
              nativeCharCount: 123,
              ocrMeanConfidence: null,
            },
            {
              page: 2,
              decision: 'OCR_LOW_CONFIDENCE_REVIEW_REQUIRED',
              reason: 'render_failed',
              nativeCharCount: 0,
              ocrMeanConfidence: null,
            },
          ],
        }),
      };
    }

    return {
      ok: true,
      text: async () => JSON.stringify({
        model: 'gpt-phase2-test',
        choices: [{
          message: {
            content: JSON.stringify({
              candidate: {
                email: { value: 'legacy.persistence@example.test', confidence: 0.75, source: 'ai' },
                currentTitle: { value: 'Senior Platform Engineer', confidence: 0.84, source: 'ai' },
                summary: { value: 'Built resilient hiring APIs.', confidence: 0.81, source: 'ai' },
              },
              metadata: {
                parser: 'careeriz-openai-test',
              },
            }),
          },
        }],
      }),
    };
  };

  const result = await processResumeImportItem(item.id, 'worker-persistence-roundtrip');
  assert.equal(result, 'success');

  const reloaded = await prisma.resumeImportItem.findUnique({ where: { id: item.id } });
  assert.ok(reloaded);
  assert.equal(reloaded.status, 'REVIEW_REQUIRED');
  assert.equal(reloaded.requiresManualReview, true);
  assert.equal(reloaded.metadata.documentProcessor.used, true);
  assert.equal(reloaded.metadata.documentProcessor.correlationId, 'corr-persistence-roundtrip');
  assert.equal(reloaded.metadata.documentProcessor.document.failedPageCount, 1);
  assert.equal(reloaded.metadata.documentProcessor.warnings.includes('partial_page_failure'), true);
  assert.equal(reloaded.metadata.documentProcessor.warnings.includes('page-2:PAGE_RENDER_FAILED'), true);
  assert.equal(reloaded.metadata.documentProcessor.warnings.includes('currentTitle: processor and deterministic values disagreed.'), true);
  assert.equal(reloaded.parsedData.candidate.email.value, 'legacy.persistence@example.test');
  assert.equal(reloaded.parsedData.candidate.email.confidence, 0.95);
  assert.equal(reloaded.parsedData.candidate.email.source, 'document_processor');
  assert.equal(reloaded.parsedData.candidate.email.evidence.page, 1);
  assert.equal(reloaded.parsedData.candidate.email.reconciliationReason, 'processor_deterministic_agreement');
  assert.equal(reloaded.parsedData.candidate.email.alternatives.deterministic.value, 'legacy.persistence@example.test');
  assert.equal(reloaded.parsedData.candidate.email.alternatives.pythonExtracted.value, 'legacy.persistence@example.test');
  assert.equal(reloaded.parsedData.candidate.email.alternatives.ai.value, 'legacy.persistence@example.test');
  assert.equal(reloaded.parsedData.candidate.currentTitle.alternatives.deterministic.value, 'Backend Engineer');
  assert.equal(reloaded.parsedData.candidate.currentTitle.alternatives.pythonExtracted.value, 'Senior Platform Engineer');
  assert.equal(reloaded.parsedData.candidate.currentTitle.alternatives.ai.value, 'Senior Platform Engineer');
  assert.equal(reloaded.parsedData.candidate.currentTitle.reconciliationReason, 'processor_selected_over_deterministic');
  assert.equal(reloaded.parsedData.candidate.summary.value, 'Built resilient hiring APIs.');
  assert.equal(reloaded.parsedData.candidate.summary.source, 'ai_with_text_evidence');
  assert.equal(reloaded.parsedData.candidate.summary.alternatives.ai.value, 'Built resilient hiring APIs.');
  assert.equal(reloaded.parsedData.metadata.reconciliation.reviewRequired, true);
  assert.equal(reloaded.parsedData.metadata.reconciliation.warnings.includes('partial_page_failure'), true);
  assert.equal(reloaded.parsedData.metadata.reconciliation.warnings.includes('page-2:PAGE_RENDER_FAILED'), true);
  assert.equal(reloaded.parsedData.metadata.reconciliation.warnings.includes('currentTitle: processor and deterministic values disagreed.'), true);
});
