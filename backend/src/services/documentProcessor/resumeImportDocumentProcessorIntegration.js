import { env } from '../../config/env.js';
import { parseResumeTextDetailed, RESUME_PARSER_VERSION } from '../ai/resume-parser.js';
import { analyseDocumentViaProcessor } from './documentProcessorClient.js';
import {
  buildDeterministicResumeParse,
  hasMinimumIdentity,
  sanitizeResumeData,
  sanitizeResumeString,
} from '../resumeImportUtils.js';

const IMPORTANT_REVIEW_FIELDS = new Set([
  'fullName',
  'email',
  'phoneNumber',
  'currentTitle',
  'location',
  'skills',
  'experienceEntries',
  'educationEntries',
]);

const SIMPLE_ARRAY_FIELDS = new Set([
  'skills',
  'functionalSkills',
  'tools',
  'frameworks',
  'cloudPlatforms',
  'databases',
  'softSkills',
]);

const STRUCTURED_ARRAY_FIELDS = new Set([
  'experienceEntries',
  'educationEntries',
  'certificationEntries',
  'projectEntries',
  'languageEntries',
  'portfolioLinks',
]);

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

function normalizeScalar(field, value) {
  if (value == null) return null;
  if (typeof value === 'number') return String(value);
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (field === 'phoneNumber') {
    return text.replace(/[^\d+]/g, '');
  }
  return text.replace(/\s+/g, ' ');
}

function valuesEquivalent(field, left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftList = Array.isArray(left) ? left.map((item) => normalizeScalar(field, item)).filter(Boolean) : [];
    const rightList = Array.isArray(right) ? right.map((item) => normalizeScalar(field, item)).filter(Boolean) : [];
    return JSON.stringify([...new Set(leftList)].sort()) === JSON.stringify([...new Set(rightList)].sort());
  }
  return normalizeScalar(field, left) === normalizeScalar(field, right);
}

function uniqueStrings(values = []) {
  return [...new Set(values
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

function selectStructuredArray(primary = [], fallback = []) {
  if (!Array.isArray(primary) || !primary.length) return Array.isArray(fallback) ? fallback : [];
  if (!Array.isArray(fallback) || !fallback.length) return primary;
  return primary.length >= fallback.length ? primary : fallback;
}

function isAllowedByConfiguredRollout(item) {
  if (!env.documentProcessorIntegrationEnabled) return false;

  const allowedCompanyIds = env.documentProcessorAllowedCompanyIds || [];
  const allowedBatchIds = env.documentProcessorAllowedBatchIds || [];

  if (!allowedCompanyIds.length && !allowedBatchIds.length) {
    return false;
  }

  return allowedBatchIds.includes(item.batchId) || allowedCompanyIds.includes(item.organisationId);
}

export function shouldUseDocumentProcessorForImportItem(item) {
  return Boolean(item) && isAllowedByConfiguredRollout(item);
}

function validateConfidence(value, context) {
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    const error = new Error(`Document processor returned an invalid confidence for ${context}.`);
    error.code = 'DOCUMENT_PROCESSOR_INVALID_CONFIDENCE';
    throw error;
  }
}

function validateCanonicalDocument(document) {
  if (!document || typeof document !== 'object') {
    const error = new Error('Document processor returned an empty document.');
    error.code = 'DOCUMENT_PROCESSOR_INVALID_DOCUMENT';
    throw error;
  }

  if (document.schemaVersion !== '1.0.0') {
    const error = new Error(`Unsupported document processor schema version: ${document.schemaVersion || 'unknown'}.`);
    error.code = 'DOCUMENT_PROCESSOR_SCHEMA_MISMATCH';
    throw error;
  }

  const pageCount = Number(document?.documentMetadata?.pageCount || document?.pages?.length || 0);
  if (!pageCount || pageCount < 1) {
    const error = new Error('Document processor did not return a valid page count.');
    error.code = 'DOCUMENT_PROCESSOR_INVALID_PAGE_REFERENCE';
    throw error;
  }

  for (const [index, page] of (document.pages || []).entries()) {
    if (!Number.isInteger(page?.pageNumber) || page.pageNumber < 1 || page.pageNumber > pageCount) {
      const error = new Error(`Document processor returned an invalid page number at index ${index}.`);
      error.code = 'DOCUMENT_PROCESSOR_INVALID_PAGE_REFERENCE';
      throw error;
    }
  }

  for (const block of [...(document.textBlocks || []), ...(document.ocrTextBlocks || [])]) {
    if (!Number.isInteger(block?.page) || block.page < 1 || block.page > pageCount) {
      const error = new Error(`Document processor returned an invalid text block page reference (${block?.page ?? 'unknown'}).`);
      error.code = 'DOCUMENT_PROCESSOR_INVALID_PAGE_REFERENCE';
      throw error;
    }
    validateConfidence(block?.confidence ?? block?.engineConfidence ?? null, `text block page ${block.page}`);
  }

  for (const page of (document.ocrPages || [])) {
    if (!Number.isInteger(page?.pageNumber) || page.pageNumber < 1 || page.pageNumber > pageCount) {
      const error = new Error(`Document processor returned an invalid OCR page reference (${page?.pageNumber ?? 'unknown'}).`);
      error.code = 'DOCUMENT_PROCESSOR_INVALID_PAGE_REFERENCE';
      throw error;
    }
    validateConfidence(page?.meanConfidence ?? null, `ocr page ${page.pageNumber}`);
    validateConfidence(page?.orientation?.classifierConfidence ?? null, `orientation page ${page.pageNumber}`);
  }

  validateConfidence(document?.extractionConfidence ?? null, 'document');
}

function sortBlocks(blocks = []) {
  return [...blocks].sort((left, right) => {
    if (left.page !== right.page) return left.page - right.page;
    return (left.readingOrder || 0) - (right.readingOrder || 0);
  });
}

function dedupeLines(lines = []) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const normalized = sanitizeResumeString(line).replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(sanitizeResumeString(line).trim());
  }
  return result;
}

function buildEvidenceIndex(document) {
  const combinedBlocks = sortBlocks([
    ...(document.textBlocks || []),
    ...(document.ocrTextBlocks || []),
  ]);
  return combinedBlocks.map((block) => ({
    page: block.page,
    text: sanitizeResumeString(block.text || ''),
    boundingBox: block.boundingBox || null,
    extractionRoute: block.extractionRoute || null,
    sourceType: block.sourceType || null,
    engine: block.engine || null,
  }));
}

function findEvidenceForValue(field, value, evidenceBlocks) {
  if (!hasMeaningfulValue(value) || !Array.isArray(evidenceBlocks) || !evidenceBlocks.length) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const evidence = findEvidenceForValue(field, item, evidenceBlocks);
      if (evidence) return evidence;
    }
    return null;
  }

  const comparable = normalizeScalar(field, value);
  if (!comparable) return null;

  const match = evidenceBlocks.find((block) => normalizeScalar(field, block.text)?.includes(comparable));
  if (!match) return null;

  return sanitizeResumeData({
    page: match.page,
    sourceText: match.text.slice(0, 240),
    boundingBox: match.boundingBox || null,
    extractionRoute: match.extractionRoute || null,
    sourceType: match.sourceType || null,
    engine: match.engine || null,
  });
}

function extractCanonicalDocumentText(document) {
  validateCanonicalDocument(document);

  const decisionByPage = new Map((document.reconciliation || []).map((entry) => [entry.page, entry]));
  const nativeBlocks = sortBlocks(document.textBlocks || []);
  const ocrBlocks = sortBlocks(document.ocrTextBlocks || []);
  const nativeByPage = nativeBlocks.reduce((acc, block) => {
    (acc.get(block.page) || acc.set(block.page, []).get(block.page)).push(block);
    return acc;
  }, new Map());
  const ocrByPage = ocrBlocks.reduce((acc, block) => {
    (acc.get(block.page) || acc.set(block.page, []).get(block.page)).push(block);
    return acc;
  }, new Map());

  const totalPages = Number(document?.documentMetadata?.pageCount || document?.pages?.length || 0);
  const warnings = [...(document.qualityWarnings || [])];
  const selectedPageTexts = [];
  let requiresManualReview = false;
  let failedPageCount = 0;

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const decision = decisionByPage.get(pageNumber);
    const native = nativeByPage.get(pageNumber) || [];
    const ocr = ocrByPage.get(pageNumber) || [];
    const ocrPage = (document.ocrPages || []).find((page) => page.pageNumber === pageNumber) || null;

    let selectedBlocks = native;
    if (decision?.decision === 'OCR_USED' || (!native.length && ocr.length)) {
      selectedBlocks = ocr;
    } else if (!native.length && !ocr.length) {
      selectedBlocks = [];
    }

    const pageLines = dedupeLines(selectedBlocks.map((block) => block.text));
    if (pageLines.length) {
      selectedPageTexts.push(pageLines.join('\n'));
    }

    if (decision?.decision === 'BOTH_RETAINED_LOW_CONFIDENCE'
      || decision?.decision === 'OCR_LOW_CONFIDENCE_REVIEW_REQUIRED'
      || ocrPage?.lowConfidence
      || ocrPage?.emptyOutput) {
      requiresManualReview = true;
    }

    if (Array.isArray(ocrPage?.warnings) && ocrPage.warnings.length) {
      warnings.push(...ocrPage.warnings.map((warning) => `page-${pageNumber}:${warning}`));
      failedPageCount += 1;
      requiresManualReview = true;
    }
  }

  const text = sanitizeResumeString(selectedPageTexts.join('\n\n')).slice(0, env.resumeImportMaxTextChars);

  return sanitizeResumeData({
    text,
    totalPages,
    selectedRoute: document.selectedRoute || null,
    correlationId: document.correlationId || null,
    processorVersion: document.parserVersion || null,
    engineVersions: document.engineVersions || {},
    extractionConfidence: document.extractionConfidence ?? null,
    warnings: dedupeLines(warnings),
    failedPageCount,
    requiresManualReview,
    processingDurations: document.processingDurations || null,
    evidenceBlocks: buildEvidenceIndex(document),
    documentSummary: {
      schemaVersion: document.schemaVersion,
      parserVersion: document.parserVersion,
      correlationId: document.correlationId,
      selectedRoute: document.selectedRoute,
      pageCount: totalPages,
      readingOrderApplied: Boolean(document.readingOrderApplied),
      extractionConfidence: document.extractionConfidence ?? null,
      fallbackReasons: document.fallbackReasons || [],
      qualityWarnings: dedupeLines(warnings),
      failedPageCount,
      preprocessing: (document.preprocessing || []).map((page) => ({
        pageNumber: page.pageNumber,
        sourceType: page.sourceType,
        plannedRoute: page.plannedRoute || null,
        textQuality: page.textQuality || null,
        warnings: page.warnings || [],
        qualityDecision: page.qualityDecision || null,
      })),
      reconciliation: (document.reconciliation || []).map((entry) => ({
        page: entry.page,
        decision: entry.decision,
        reason: entry.reason,
        nativeCharCount: entry.nativeCharCount ?? null,
        ocrMeanConfidence: entry.ocrMeanConfidence ?? null,
      })),
      ocrPages: (document.ocrPages || []).map((page) => ({
        pageNumber: page.pageNumber,
        extractionRoute: page.extractionRoute,
        sourceType: page.sourceType,
        lowConfidence: Boolean(page.lowConfidence),
        emptyOutput: Boolean(page.emptyOutput),
        warnings: page.warnings || [],
        meanConfidence: page.meanConfidence ?? null,
        orientation: page.orientation || null,
      })),
    },
  });
}

function buildArrayFieldValue(field, legacyField, processorField, aiField, reviewState) {
  const legacyValue = legacyField?.value;
  const processorValue = processorField?.value;
  const aiValue = aiField?.value;

  let value = [];
  let source = 'none';
  let confidence = 0;
  let reason = 'missing';

  if (SIMPLE_ARRAY_FIELDS.has(field)) {
    value = uniqueStrings([
      ...(Array.isArray(processorValue) ? processorValue : []),
      ...(Array.isArray(legacyValue) ? legacyValue : []),
    ]);

    if (value.length) {
      source = Array.isArray(processorValue) && processorValue.length ? 'document_processor' : 'deterministic';
      confidence = Math.max(Number(processorField?.confidence || 0), Number(legacyField?.confidence || 0));
      reason = Array.isArray(processorValue) && Array.isArray(legacyValue) && !valuesEquivalent(field, processorValue, legacyValue)
        ? 'merged_sources'
        : source;
      if (reason === 'merged_sources') {
        reviewState.required ||= IMPORTANT_REVIEW_FIELDS.has(field);
        reviewState.warnings.push(`${field}: processor and deterministic skill sets differed.`);
      }
    } else if (Array.isArray(aiValue) && aiValue.length) {
      value = uniqueStrings(aiValue);
      source = 'ai_with_text_evidence';
      confidence = Number(aiField?.confidence || 0);
      reason = 'ai_fill';
    }
  } else {
    value = selectStructuredArray(processorValue, legacyValue);
    if (value.length) {
      source = Array.isArray(processorValue) && processorValue.length ? 'document_processor' : 'deterministic';
      confidence = Math.max(Number(processorField?.confidence || 0), Number(legacyField?.confidence || 0));
      if (Array.isArray(processorValue) && Array.isArray(legacyValue)
        && processorValue.length
        && legacyValue.length
        && JSON.stringify(processorValue) !== JSON.stringify(legacyValue)) {
        reviewState.required ||= IMPORTANT_REVIEW_FIELDS.has(field);
        reviewState.warnings.push(`${field}: processor and deterministic structured entries differed.`);
        reason = 'structured_disagreement';
      } else {
        reason = source;
      }
    }
  }

  return {
    value,
    confidence,
    source,
    reconciliationReason: reason,
  };
}

function buildScalarFieldValue(field, legacyField, processorField, aiField, selectedText, evidenceBlocks, reviewState) {
  const legacyValue = legacyField?.value;
  const processorValue = processorField?.value;
  const aiValue = aiField?.value;
  const processorConfidence = Number(processorField?.confidence || 0);
  const legacyConfidence = Number(legacyField?.confidence || 0);
  const aiConfidence = Number(aiField?.confidence || 0);

  let selectedField = null;
  let reconciliationReason = 'missing';

  if (hasMeaningfulValue(processorValue) && !hasMeaningfulValue(legacyValue)) {
    selectedField = { ...processorField, source: 'document_processor' };
    reconciliationReason = 'processor_only';
  } else if (!hasMeaningfulValue(processorValue) && hasMeaningfulValue(legacyValue)) {
    selectedField = { ...legacyField, source: 'deterministic' };
    reconciliationReason = 'deterministic_only';
  } else if (hasMeaningfulValue(processorValue) && hasMeaningfulValue(legacyValue)) {
    if (valuesEquivalent(field, processorValue, legacyValue)) {
      selectedField = processorConfidence >= legacyConfidence
        ? { ...processorField, source: 'document_processor' }
        : { ...legacyField, source: 'deterministic' };
      reconciliationReason = 'processor_deterministic_agreement';
    } else {
      const selectedFromProcessor = processorConfidence >= legacyConfidence;
      selectedField = selectedFromProcessor
        ? { ...processorField, source: 'document_processor' }
        : { ...legacyField, source: 'deterministic' };
      reconciliationReason = selectedFromProcessor
        ? 'processor_selected_over_deterministic'
        : 'deterministic_selected_over_processor';
      reviewState.required ||= IMPORTANT_REVIEW_FIELDS.has(field);
      reviewState.warnings.push(`${field}: processor and deterministic values disagreed.`);
    }
  }

  if (!hasMeaningfulValue(selectedField?.value) && hasMeaningfulValue(aiValue)) {
    const aiEvidence = findEvidenceForValue(field, aiValue, evidenceBlocks)
      || (normalizeScalar(field, selectedText)?.includes(normalizeScalar(field, aiValue) || '') ? { sourceText: 'document_text_match' } : null);
    if (aiEvidence) {
      selectedField = {
        ...aiField,
        source: 'ai_with_text_evidence',
        evidence: aiEvidence,
      };
      reconciliationReason = 'ai_fill_with_text_evidence';
    } else {
      reviewState.required ||= IMPORTANT_REVIEW_FIELDS.has(field);
      reviewState.warnings.push(`${field}: rejected unsupported AI-only value.`);
    }
  } else if (hasMeaningfulValue(selectedField?.value) && hasMeaningfulValue(aiValue) && !valuesEquivalent(field, selectedField.value, aiValue) && aiConfidence > 0.55) {
    reviewState.required ||= IMPORTANT_REVIEW_FIELDS.has(field);
    reviewState.warnings.push(`${field}: AI disagreed with evidence-backed extraction.`);
  }

  const evidence = selectedField?.source === 'document_processor'
    ? findEvidenceForValue(field, selectedField?.value, evidenceBlocks)
    : selectedField?.evidence || null;

  return sanitizeResumeData({
    value: selectedField?.value ?? null,
    confidence: Number(selectedField?.confidence || 0),
    source: selectedField?.source || 'none',
    evidence,
    reconciliationReason,
  });
}

function reconcileHybridCandidate({ legacyDetailed, processorDetailed, processorExtraction }) {
  const reviewState = {
    required: Boolean(processorExtraction.requiresManualReview),
    warnings: [...(processorExtraction.warnings || [])],
  };
  const selectedText = processorExtraction.text || '';
  const evidenceBlocks = processorExtraction.evidenceBlocks || [];

  const fieldNames = new Set([
    ...Object.keys(legacyDetailed?.deterministicCandidate || {}),
    ...Object.keys(processorDetailed?.deterministicCandidate || {}),
    ...Object.keys(processorDetailed?.aiCandidate || {}),
  ]);

  const candidate = {};
  const fields = {};

  for (const field of fieldNames) {
    const legacyField = legacyDetailed?.deterministicCandidate?.[field] || null;
    const processorField = processorDetailed?.deterministicCandidate?.[field] || null;
    const aiField = processorDetailed?.aiCandidate?.[field] || null;

    const selection = SIMPLE_ARRAY_FIELDS.has(field) || STRUCTURED_ARRAY_FIELDS.has(field)
      ? buildArrayFieldValue(field, legacyField, processorField, aiField, reviewState)
      : buildScalarFieldValue(field, legacyField, processorField, aiField, selectedText, evidenceBlocks, reviewState);

    const alternatives = sanitizeResumeData({
      deterministic: legacyField ? { value: legacyField.value ?? null, confidence: Number(legacyField.confidence || 0) } : null,
      pythonExtracted: processorField ? { value: processorField.value ?? null, confidence: Number(processorField.confidence || 0) } : null,
      ai: aiField ? { value: aiField.value ?? null, confidence: Number(aiField.confidence || 0) } : null,
    });

    candidate[field] = sanitizeResumeData({
      value: selection.value ?? null,
      confidence: Number(selection.confidence || 0),
      source: selection.source || 'none',
      evidence: selection.evidence || null,
      reconciliationReason: selection.reconciliationReason || 'missing',
      alternatives,
    });
    fields[field] = candidate[field];
  }

  return {
    candidate,
    reconciliation: {
      reviewRequired: reviewState.required,
      warnings: dedupeLines(reviewState.warnings),
      fields,
    },
  };
}

export async function buildResumeImportDocumentProcessorResult({ item, fileBuffer, legacyExtractedText }) {
  if (!shouldUseDocumentProcessorForImportItem(item)) {
    return {
      attempted: false,
      used: false,
      success: false,
      fallbackReason: 'DOCUMENT_PROCESSOR_NOT_ALLOWLISTED',
      retryable: false,
      extractedText: '',
      parsedData: null,
      requiresManualReview: false,
      metadata: {
        attempted: false,
        used: false,
        rolloutMatched: false,
      },
    };
  }

  const processorResult = await analyseDocumentViaProcessor({
    fileBuffer,
    originalFilename: item.originalFilename,
    mimeType: item.mimeType,
    routeHint: 'auto',
  });

  if (!processorResult.success) {
    return {
      attempted: true,
      used: false,
      success: false,
      fallbackReason: processorResult.fallbackReason,
      fallbackMessage: processorResult.fallbackMessage,
      retryable: Boolean(processorResult.retryable),
      extractedText: '',
      parsedData: null,
      requiresManualReview: false,
      metadata: {
        attempted: true,
        used: false,
        rolloutMatched: true,
        fallbackReason: processorResult.fallbackReason,
        retryable: Boolean(processorResult.retryable),
      },
    };
  }

  let processorExtraction;
  try {
    processorExtraction = extractCanonicalDocumentText(processorResult.document);
  } catch (error) {
    return {
      attempted: true,
      used: false,
      success: false,
      fallbackReason: error?.code || 'DOCUMENT_PROCESSOR_INVALID_DOCUMENT',
      fallbackMessage: String(error?.message || 'Document processor returned an invalid canonical document.').slice(0, 1000),
      retryable: false,
      extractedText: '',
      parsedData: null,
      requiresManualReview: true,
      metadata: {
        attempted: true,
        used: false,
        rolloutMatched: true,
        correlationId: processorResult.document?.correlationId || null,
        fallbackReason: error?.code || 'DOCUMENT_PROCESSOR_INVALID_DOCUMENT',
      },
    };
  }
  if (!processorExtraction.text) {
    return {
      attempted: true,
      used: false,
      success: false,
      fallbackReason: 'DOCUMENT_PROCESSOR_EMPTY_OUTPUT',
      fallbackMessage: 'Document processor returned no usable text.',
      retryable: false,
      extractedText: '',
      parsedData: null,
      requiresManualReview: true,
      metadata: {
        attempted: true,
        used: false,
        rolloutMatched: true,
        correlationId: processorExtraction.correlationId,
        fallbackReason: 'DOCUMENT_PROCESSOR_EMPTY_OUTPUT',
        document: processorExtraction.documentSummary,
      },
    };
  }

  const processorDetailed = await parseResumeTextDetailed(processorExtraction.text, {
    originalFilename: item.originalFilename,
  });

  const legacyDetailed = legacyExtractedText
    ? {
      deterministicCandidate: sanitizeResumeData(buildDeterministicResumeParse(legacyExtractedText, item.originalFilename).candidate),
    }
    : { deterministicCandidate: {} };

  const reconciled = reconcileHybridCandidate({
    legacyDetailed,
    processorDetailed,
    processorExtraction,
  });

  const parsedData = sanitizeResumeData({
    candidate: reconciled.candidate,
    metadata: {
      parser: 'careeriz-resume-import-hybrid-v1',
      parserVersion: RESUME_PARSER_VERSION,
      generatedAt: new Date().toISOString(),
      stages: {
        deterministic: true,
        documentProcessor: true,
        aiRequested: Boolean(processorDetailed?.metadata?.aiRequested),
        aiCompleted: Boolean(processorDetailed?.metadata?.stages?.aiCompleted),
      },
      aiProvider: Boolean(processorDetailed?.metadata?.aiProvider),
      aiRequested: Boolean(processorDetailed?.metadata?.aiRequested),
      aiFallbackReason: processorDetailed?.metadata?.aiFallbackReason || null,
      documentProcessor: {
        attempted: true,
        used: true,
        selectedRoute: processorExtraction.selectedRoute,
        correlationId: processorExtraction.correlationId,
        parserVersion: processorExtraction.processorVersion,
        engineVersions: processorExtraction.engineVersions,
        extractionConfidence: processorExtraction.extractionConfidence,
        processingDurations: processorExtraction.processingDurations,
        document: processorExtraction.documentSummary,
      },
      reconciliation: reconciled.reconciliation,
    },
  });

  return {
    attempted: true,
    used: true,
    success: true,
    extractedText: processorExtraction.text,
    parsedData,
    parserVersion: parsedData?.metadata?.parser,
    requiresManualReview: Boolean(
      processorExtraction.requiresManualReview
      || reconciled.reconciliation.reviewRequired
      || !hasMinimumIdentity(parsedData)
      || parsedData?.metadata?.aiFallbackReason
    ),
    metadata: {
      attempted: true,
      used: true,
      rolloutMatched: true,
      correlationId: processorExtraction.correlationId,
      selectedRoute: processorExtraction.selectedRoute,
      document: processorExtraction.documentSummary,
      warnings: reconciled.reconciliation.warnings,
    },
  };
}
