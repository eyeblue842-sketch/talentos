import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  requisitionApprovalSchema,
  requisitionCreateSchema,
  requisitionUpdateSchema,
} from '@careeriz/shared';
import {
  approveOrganisationRequisition,
  createOrganisationRequisition,
  editOrganisationRequisition,
  getOrganisationRequisitions,
} from '../controllers/requisitionController.js';

export const requisitionRouter = Router();

requisitionRouter.get('/', auth(['RECRUITER']), getOrganisationRequisitions);
requisitionRouter.post('/', auth(['RECRUITER']), validateSchema(requisitionCreateSchema), createOrganisationRequisition);
requisitionRouter.patch('/:requisitionId', auth(['RECRUITER']), validateSchema(requisitionUpdateSchema), editOrganisationRequisition);
requisitionRouter.post('/:requisitionId/approval', auth(['RECRUITER']), validateSchema(requisitionApprovalSchema), approveOrganisationRequisition);
