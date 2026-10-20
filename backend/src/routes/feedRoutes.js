import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getFeedController,
  createFeedPostController,
  deleteFeedPostController,
  getNetworkFeedController,
  toggleFeedReactionController,
} from '../controllers/feedController.js';

export const feedRouter = Router();

// Candidate feed: merged timeline of followed-company posts + the candidate's own posts.
feedRouter.get('/', auth(['CANDIDATE']), getFeedController);
feedRouter.post('/posts', auth(['CANDIDATE']), createFeedPostController);
feedRouter.delete('/posts/:postId', auth(['CANDIDATE']), deleteFeedPostController);

// Network feed: connections' posts plus what they liked or shared (recruiters and candidates).
feedRouter.get('/network', auth(['RECRUITER', 'CANDIDATE']), getNetworkFeedController);
feedRouter.post('/posts/:postId/reaction', auth(['RECRUITER', 'CANDIDATE']), toggleFeedReactionController);
