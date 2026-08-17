import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { requireVerifiedOrganisation } from '../middleware/organisationVerification.js';
import {
  organisationInvitationCreateSchema,
  organisationInvitationTokenSchema,
  organisationPostCreateSchema,
  organisationCreateSchema,
  organisationMemberCreateSchema,
  organisationMemberUpdateSchema,
  recruiterOnboardingSchema,
} from '@careeriz/shared';
import {
  acceptInvitationToken,
  completeOrganisationOnboarding,
  createOrganisation,
  getInvitationTokenDetail,
  createOrganisationMember,
  editOrganisationMember,
  getOrganisation,
  getOrganisationAuditLogs,
  getOrganisationInvitations,
  getOrganisationMembers,
  getOrganisationOnboarding,
  postOrganisationInvitation,
  postOrganisationPost,
  postOrganisationInvitationResend,
  postOrganisationInvitationRevoke,
} from '../controllers/organisationController.js';

export const organisationRouter = Router();

organisationRouter.post('/', auth(['RECRUITER']), validateSchema(organisationCreateSchema), createOrganisation);
organisationRouter.get('/current', auth(['RECRUITER']), getOrganisation);
organisationRouter.get('/current/onboarding', auth(['RECRUITER']), getOrganisationOnboarding);
organisationRouter.post('/current/onboarding', auth(['RECRUITER']), validateSchema(recruiterOnboardingSchema), completeOrganisationOnboarding);
organisationRouter.get('/members', auth(['RECRUITER']), getOrganisationMembers);
// Inviting/adding a NEW member ("invite additional recruiter members" -
// domain-ownership closure section 1) is gated; managing an ALREADY-active
// member's role, and viewing/using an invitation someone already holds
// (accept, below), are not - a PENDING organisation must not be able to
// grow its recruiter headcount, but existing members and pending
// invitations already extended must keep working normally.
organisationRouter.post('/members', auth(['RECRUITER']), requireVerifiedOrganisation(), validateSchema(organisationMemberCreateSchema), createOrganisationMember);
organisationRouter.patch('/members/:membershipId', auth(['RECRUITER']), validateSchema(organisationMemberUpdateSchema), editOrganisationMember);
organisationRouter.get('/invitations', auth(['RECRUITER']), getOrganisationInvitations);
organisationRouter.post('/invitations', auth(['RECRUITER']), requireVerifiedOrganisation(), validateSchema(organisationInvitationCreateSchema), postOrganisationInvitation);
organisationRouter.post('/invitations/:invitationId/resend', auth(['RECRUITER']), postOrganisationInvitationResend);
organisationRouter.post('/invitations/:invitationId/revoke', auth(['RECRUITER']), postOrganisationInvitationRevoke);
organisationRouter.get('/invitations/token/:token', getInvitationTokenDetail);
organisationRouter.post('/invitations/accept', auth(['RECRUITER']), validateSchema(organisationInvitationTokenSchema), acceptInvitationToken);
organisationRouter.get('/audit-logs', auth(['RECRUITER']), getOrganisationAuditLogs);
organisationRouter.post('/current/posts', auth(['RECRUITER']), validateSchema(organisationPostCreateSchema), postOrganisationPost);
