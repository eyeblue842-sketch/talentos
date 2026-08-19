import { z } from 'zod';

export const resumeSearchIndexStatusSchema = z.enum([
  'PENDING',
  'INDEXED',
  'RETRY_SCHEDULED',
  'FAILED',
  'DELETED',
  'SKIPPED',
]);
