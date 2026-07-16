import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  organisationCreateSchema,
  organisationMemberCreateSchema,
  organisationMemberUpdateSchema,
} from '@careeriz/shared';
import {
  createOrganisation,
  createOrganisationMember,
  editOrganisationMember,
  getOrganisation,
  getOrganisationAuditLogs,
  getOrganisationMembers,
} from '../controllers/organisationController.js';

export const organisationRouter = Router();

organisationRouter.post('/', auth(['RECRUITER']), validateSchema(organisationCreateSchema), createOrganisation);
organisationRouter.get('/current', auth(['RECRUITER']), getOrganisation);
organisationRouter.get('/members', auth(['RECRUITER']), getOrganisationMembers);
organisationRouter.post('/members', auth(['RECRUITER']), validateSchema(organisationMemberCreateSchema), createOrganisationMember);
organisationRouter.patch('/members/:membershipId', auth(['RECRUITER']), validateSchema(organisationMemberUpdateSchema), editOrganisationMember);
organisationRouter.get('/audit-logs', auth(['RECRUITER']), getOrganisationAuditLogs);
