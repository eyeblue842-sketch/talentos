import multer from 'multer';
import { Router } from 'express';
import {
  resumeImportBatchRetrySchema,
  resumeImportDuplicateResolutionInputSchema,
  resumeImportItemConfirmSchema,
  resumeImportItemListQuerySchema,
  resumeImportItemPatchSchema,
  resumeImportItemRejectSchema,
  resumeImportItemRetrySchema,
  resumeImportListQuerySchema,
} from '@careeriz/shared';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  downloadResumeImportBatchItem,
  getResumeImportBatchFailureReport,
  getResumeImportBatchItemDownloadUrl,
  getResumeImport,
  getResumeImportBatchItem,
  getResumeImportBatchItems,
  getResumeImports,
  getResumeImportWorkerStatus,
  patchResumeImportBatchItem,
  postResumeImportBatch,
  postResumeImportBatchItemConfirm,
  postResumeImportBatchItemReject,
  postResumeImportBatchItemResolveDuplicate,
  postResumeImportBatchItemRetry,
  postResumeImportBatchRetryFailed,
} from '../controllers/resumeImportController.js';
import { env } from '../config/env.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: env.resumeImportMaxFiles,
    fileSize: env.resumeImportMaxZipSizeMb * 1024 * 1024,
  },
});

export const resumeImportRouter = Router();

resumeImportRouter.use(auth(['RECRUITER', 'ADMIN']));
resumeImportRouter.post('/', upload.array('files', env.resumeImportMaxFiles), postResumeImportBatch);
resumeImportRouter.get('/worker-status', getResumeImportWorkerStatus);
resumeImportRouter.get('/', validateSchema(resumeImportListQuerySchema.partial(), 'query'), getResumeImports);
resumeImportRouter.get('/:batchId', getResumeImport);
resumeImportRouter.get('/:batchId/items', validateSchema(resumeImportItemListQuerySchema.partial(), 'query'), getResumeImportBatchItems);
resumeImportRouter.get('/:batchId/failure-report', getResumeImportBatchFailureReport);
resumeImportRouter.post('/:batchId/retry-failed', validateSchema(resumeImportBatchRetrySchema.partial(), 'body'), postResumeImportBatchRetryFailed);
resumeImportRouter.get('/:batchId/items/:itemId', getResumeImportBatchItem);
resumeImportRouter.patch('/:batchId/items/:itemId', validateSchema(resumeImportItemPatchSchema.partial(), 'body'), patchResumeImportBatchItem);
resumeImportRouter.post('/:batchId/items/:itemId/retry', validateSchema(resumeImportItemRetrySchema.partial(), 'body'), postResumeImportBatchItemRetry);
resumeImportRouter.post('/:batchId/items/:itemId/confirm', validateSchema(resumeImportItemConfirmSchema, 'body'), postResumeImportBatchItemConfirm);
resumeImportRouter.post('/:batchId/items/:itemId/reject', validateSchema(resumeImportItemRejectSchema, 'body'), postResumeImportBatchItemReject);
resumeImportRouter.post('/:batchId/items/:itemId/resolve-duplicate', validateSchema(resumeImportDuplicateResolutionInputSchema, 'body'), postResumeImportBatchItemResolveDuplicate);
resumeImportRouter.get('/:batchId/items/:itemId/download-url', getResumeImportBatchItemDownloadUrl);
resumeImportRouter.get('/:batchId/items/:itemId/download', downloadResumeImportBatchItem);
