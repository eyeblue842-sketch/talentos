import { Router } from 'express';
import {
  createRecruiterJob,
  getRecruiterJobDetail,
  getRecruiterJobs,
  editRecruiterJob,
  changeRecruiterJobStatus,
  removeRecruiterJob,
  getPublicJobs,
} from '../controllers/jobController.js';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { requireVerifiedOrganisation } from '../middleware/organisationVerification.js';
import { createJobSchema, updateJobSchema, updateJobStatusSchema } from '@careeriz/shared';

export const jobRouter = Router();

jobRouter.get('/public', getPublicJobs);
jobRouter.get('/', auth(['RECRUITER']), getRecruiterJobs);
// createJobSchema/updateJobSchema both allow `status` as an ordinary field
// (matching the recruiter job form, which submits status alongside every
// other field), so whether a given POST/PATCH request is actually
// publishing can only be known inside the service, not here at the route
// layer - draft-only requests must stay unaffected. The real,
// comprehensive gate for these two routes is the SERVICE-level
// assertOrganisationVerifiedForAction() call inside
// jobService.activateJobInTransaction (final publication-bypass closure,
// section 1), not route middleware. The status-change route below is kept
// gated here too because it is unconditionally a publish-intent request -
// this is the cheap "early rejection" layer the service-level check
// backstops.
jobRouter.post('/', auth(['RECRUITER']), validateSchema(createJobSchema), createRecruiterJob);
jobRouter.get('/:jobId', auth(['RECRUITER']), getRecruiterJobDetail);
jobRouter.patch('/:jobId', auth(['RECRUITER']), validateSchema(updateJobSchema), editRecruiterJob);
jobRouter.post('/:jobId/status', auth(['RECRUITER']), requireVerifiedOrganisation(), validateSchema(updateJobStatusSchema), changeRecruiterJobStatus);
jobRouter.delete('/:jobId', auth(['RECRUITER']), removeRecruiterJob);
