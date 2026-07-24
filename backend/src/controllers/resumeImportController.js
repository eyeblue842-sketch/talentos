import {
  confirmResumeImportItem,
  createResumeImportBatch,
  getResumeImportBatch,
  getResumeImportFailureReport,
  getResumeImportItem,
  getResumeImportItemDownload,
  listResumeImportBatches,
  listResumeImportItems,
  rejectResumeImportItem,
  resolveResumeImportDuplicate,
  retryFailedResumeImportBatchItems,
  retryResumeImportItem,
  streamResumeImportItemFile,
  updateResumeImportItem,
} from '../services/resumeImportService.js';
import { sendSuccess } from '../utils/response.js';

function pipeDownload(res, filename, mimeType, contentLength, stream) {
  if (mimeType) res.setHeader('Content-Type', mimeType);
  if (contentLength) res.setHeader('Content-Length', String(contentLength));
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  stream.pipe(res);
}

function meta(req) {
  return {
    actorUserId: req.user?.id || null,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId,
  };
}

export async function postResumeImportBatch(req, res, next) {
  try {
    const result = await createResumeImportBatch(req.user, req.files || [], req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getResumeImports(req, res, next) {
  try {
    const result = await listResumeImportBatches(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getResumeImport(req, res, next) {
  try {
    const result = await getResumeImportBatch(req.user, req.params.batchId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getResumeImportBatchItems(req, res, next) {
  try {
    const result = await listResumeImportItems(req.user, req.params.batchId, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getResumeImportBatchItem(req, res, next) {
  try {
    const result = await getResumeImportItem(req.user, req.params.batchId, req.params.itemId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchResumeImportBatchItem(req, res, next) {
  try {
    const result = await updateResumeImportItem(req.user, req.params.batchId, req.params.itemId, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postResumeImportBatchItemRetry(req, res, next) {
  try {
    const result = await retryResumeImportItem(req.user, req.params.batchId, req.params.itemId, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postResumeImportBatchRetryFailed(req, res, next) {
  try {
    const result = await retryFailedResumeImportBatchItems(req.user, req.params.batchId, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postResumeImportBatchItemConfirm(req, res, next) {
  try {
    const result = await confirmResumeImportItem(req.user, req.params.batchId, req.params.itemId, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postResumeImportBatchItemReject(req, res, next) {
  try {
    const result = await rejectResumeImportItem(req.user, req.params.batchId, req.params.itemId, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postResumeImportBatchItemResolveDuplicate(req, res, next) {
  try {
    const result = await resolveResumeImportDuplicate(req.user, req.params.batchId, req.params.itemId, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getResumeImportBatchFailureReport(req, res, next) {
  try {
    const report = await getResumeImportFailureReport(req.user, req.params.batchId, req.user.activeMembership?.organisationId);
    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.status(200).send(report.body);
  } catch (error) {
    next(error);
  }
}

export async function getResumeImportBatchItemDownloadUrl(req, res, next) {
  try {
    const result = await getResumeImportItemDownload(req.user, req.params.batchId, req.params.itemId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadResumeImportBatchItem(req, res, next) {
  try {
    const result = await streamResumeImportItemFile(req.user, req.params.batchId, req.params.itemId, req.user.activeMembership?.organisationId);
    pipeDownload(res, result.item.originalFilename, result.item.mimeType, result.file.contentLength, result.file.stream);
  } catch (error) {
    next(error);
  }
}
