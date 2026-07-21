import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  offerApprovalActionSchema,
  offerCandidateAcceptSchema,
  offerCandidateRejectSchema,
  offerCandidateRevisionRequestSchema,
  offerDraftCreateSchema,
  offerDraftUpdateSchema,
  offerJoiningUpdateSchema,
  offerReleaseSchema,
  offerRequestApprovalSchema,
  offerRevisionCreateSchema,
  offerWithdrawSchema,
} from '@careeriz/shared';
import {
  downloadCandidateOfferPdf,
  downloadRecruiterOfferPdf,
  downloadTokenOfferPdf,
  getCandidateOfferController,
  getCandidateOfferForApplicationController,
  getOffer,
  getOffersByApplication,
  getTokenOffer,
  patchOfferDraft,
  postCandidateOfferAccept,
  postCandidateOfferReject,
  postCandidateOfferRevisionRequest,
  postOfferApprovalApprove,
  postOfferApprovalChanges,
  postOfferApprovalReject,
  postOfferApprovalRequest,
  postOfferDraft,
  postOfferJoining,
  postOfferRelease,
  postOfferRevision,
  postOfferWithdraw,
  postTokenOfferAccept,
  postTokenOfferReject,
  postTokenOfferRevisionRequest,
} from '../controllers/offerController.js';

export const offerRouter = Router();

offerRouter.post('/', auth(['RECRUITER']), validateSchema(offerDraftCreateSchema), postOfferDraft);
offerRouter.get('/application/:applicationId', auth(['RECRUITER']), getOffersByApplication);
offerRouter.get('/:offerId', auth(['RECRUITER']), getOffer);
offerRouter.patch('/:offerId', auth(['RECRUITER']), validateSchema(offerDraftUpdateSchema), patchOfferDraft);
offerRouter.post('/:offerId/request-approval', auth(['RECRUITER']), validateSchema(offerRequestApprovalSchema), postOfferApprovalRequest);
offerRouter.post('/:offerId/approvals/:approvalId/approve', auth(['RECRUITER']), validateSchema(offerApprovalActionSchema), postOfferApprovalApprove);
offerRouter.post('/:offerId/approvals/:approvalId/request-changes', auth(['RECRUITER']), validateSchema(offerApprovalActionSchema), postOfferApprovalChanges);
offerRouter.post('/:offerId/approvals/:approvalId/reject', auth(['RECRUITER']), validateSchema(offerApprovalActionSchema), postOfferApprovalReject);
offerRouter.post('/:offerId/release', auth(['RECRUITER']), validateSchema(offerReleaseSchema), postOfferRelease);
offerRouter.post('/revisions', auth(['RECRUITER']), validateSchema(offerRevisionCreateSchema), postOfferRevision);
offerRouter.post('/:offerId/withdraw', auth(['RECRUITER']), validateSchema(offerWithdrawSchema), postOfferWithdraw);
offerRouter.post('/:offerId/joining', auth(['RECRUITER']), validateSchema(offerJoiningUpdateSchema), postOfferJoining);
offerRouter.get('/:offerId/pdf', auth(['RECRUITER']), downloadRecruiterOfferPdf);

offerRouter.get('/candidate/application/:applicationId', auth(['CANDIDATE']), getCandidateOfferForApplicationController);
offerRouter.get('/candidate/:offerId', auth(['CANDIDATE']), getCandidateOfferController);
offerRouter.post('/candidate/:offerId/accept', auth(['CANDIDATE']), validateSchema(offerCandidateAcceptSchema), postCandidateOfferAccept);
offerRouter.post('/candidate/:offerId/reject', auth(['CANDIDATE']), validateSchema(offerCandidateRejectSchema), postCandidateOfferReject);
offerRouter.post('/candidate/:offerId/revision-request', auth(['CANDIDATE']), validateSchema(offerCandidateRevisionRequestSchema), postCandidateOfferRevisionRequest);
offerRouter.get('/candidate/:offerId/pdf', auth(['CANDIDATE']), downloadCandidateOfferPdf);

offerRouter.get('/access/:token', getTokenOffer);
offerRouter.post('/access/:token/accept', validateSchema(offerCandidateAcceptSchema), postTokenOfferAccept);
offerRouter.post('/access/:token/reject', validateSchema(offerCandidateRejectSchema), postTokenOfferReject);
offerRouter.post('/access/:token/revision-request', validateSchema(offerCandidateRevisionRequestSchema), postTokenOfferRevisionRequest);
offerRouter.get('/access/:token/pdf', downloadTokenOfferPdf);
