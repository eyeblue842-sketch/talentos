import { Router } from 'express';
import {
  companyFollowSchema,
  networkPaginationQuerySchema,
  networkPrivacyUpdateSchema,
  networkRequestCreateSchema,
  networkSuggestionQuerySchema,
  peopleSearchQuerySchema,
} from '@careeriz/shared';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import {
  acceptRequest,
  createBlock,
  createCompanyFollow,
  createRequest,
  declineRequest,
  deleteBlock,
  deleteCompanyFollow,
  deleteConnection,
  deleteRequest,
  getCompanyFollow,
  getPeopleProfile,
  getPrivacy,
  listConnections,
  listMutualConnections,
  listReceivedRequests,
  listSentRequests,
  listSuggestions,
  patchPrivacy,
  searchPeopleController,
} from '../controllers/networkController.js';

export const networkRouter = Router();

const connectionRequestRateLimiter = createRateLimiter({
  keyPrefix: 'network-request',
  limit: Number(process.env.NETWORK_REQUEST_RATE_LIMIT || 30),
  windowMinutes: Number(process.env.NETWORK_REQUEST_WINDOW_MINUTES || 60),
  keyResolver: (req) => req.user?.id || req.ip,
});

networkRouter.use(auth(['CANDIDATE', 'CANDIDATE_ADMIN', 'RECRUITER', 'RECRUITER_ADMIN']));

networkRouter.get('/connections', validateSchema(networkPaginationQuerySchema, 'query'), listConnections);
networkRouter.get('/requests/received', validateSchema(networkPaginationQuerySchema, 'query'), listReceivedRequests);
networkRouter.get('/requests/sent', validateSchema(networkPaginationQuerySchema, 'query'), listSentRequests);
networkRouter.post('/requests', connectionRequestRateLimiter, validateSchema(networkRequestCreateSchema), createRequest);
networkRouter.post('/requests/:requestId/accept', acceptRequest);
networkRouter.post('/requests/:requestId/decline', declineRequest);
networkRouter.delete('/requests/:requestId', deleteRequest);
networkRouter.delete('/connections/:connectionId', deleteConnection);
networkRouter.post('/users/:userId/block', createBlock);
networkRouter.delete('/users/:userId/block', deleteBlock);
networkRouter.get('/users/:userId/mutual', validateSchema(networkPaginationQuerySchema, 'query'), listMutualConnections);
networkRouter.get('/people/:userId', getPeopleProfile);
networkRouter.get('/suggestions', validateSchema(networkSuggestionQuerySchema, 'query'), listSuggestions);
networkRouter.get('/search', validateSchema(peopleSearchQuerySchema, 'query'), searchPeopleController);
networkRouter.get('/privacy', getPrivacy);
networkRouter.patch('/privacy', validateSchema(networkPrivacyUpdateSchema), patchPrivacy);
networkRouter.get('/company-follows/:organisationId', getCompanyFollow);
networkRouter.post('/company-follows', validateSchema(companyFollowSchema), createCompanyFollow);
networkRouter.delete('/company-follows/:organisationId', deleteCompanyFollow);
