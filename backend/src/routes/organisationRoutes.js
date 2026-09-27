import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { requireVerifiedOrganisation } from '../middleware/organisationVerification.js';
import { imageUpload } from '../middleware/imageUpload.js';
import {
  organisationInvitationCreateSchema,
  organisationInvitationTokenSchema,
  organisationPostCreateSchema,
  organisationCreateSchema,
  organisationMemberCreateSchema,
  organisationMemberUpdateSchema,
  recruiterOnboardingSchema,
  recruiterOrganisationProfileUpdateSchema,
} from '@careeriz/shared';
import {
  acceptInvitationToken,
  completeOrganisationOnboarding,
  patchOrganisationProfile,
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
  updateOrganisationPost,
  deleteOrganisationPost,
  postOrganisationInvitationResend,
  postOrganisationInvitationRevoke,
  postOrganisationLogo,
  getOrganisationLogo,
} from '../controllers/organisationController.js';

export const organisationRouter = Router();

// Public: stream an organisation's uploaded logo (referenced by logoUrl on
// public company pages). Declared before the param-free literal routes is not
// required since the path shape is unique, but keep auth OFF deliberately.
organisationRouter.get('/:organisationId/logo', getOrganisationLogo);

organisationRouter.post('/', auth(['RECRUITER']), validateSchema(organisationCreateSchema), createOrganisation);
organisationRouter.get('/current', auth(['RECRUITER']), getOrganisation);
organisationRouter.get('/current/onboarding', auth(['RECRUITER']), getOrganisationOnboarding);
organisationRouter.post('/current/onboarding', auth(['RECRUITER']), validateSchema(recruiterOnboardingSchema), completeOrganisationOnboarding);
organisationRouter.patch('/current/profile', auth(['RECRUITER']), validateSchema(recruiterOrganisationProfileUpdateSchema), patchOrganisationProfile);
organisationRouter.post('/current/logo', auth(['RECRUITER']), imageUpload.single('logo'), postOrganisationLogo);
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
organisationRouter.patch('/current/posts/:postId', auth(['RECRUITER']), validateSchema(organisationPostCreateSchema), updateOrganisationPost);
organisationRouter.delete('/current/posts/:postId', auth(['RECRUITER']), deleteOrganisationPost);
