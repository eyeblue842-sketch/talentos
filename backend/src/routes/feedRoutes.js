import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getFeedController,
  createFeedPostController,
  deleteFeedPostController,
} from '../controllers/feedController.js';

export const feedRouter = Router();

// Candidate feed: merged timeline of followed-company posts + the candidate's own posts.
feedRouter.get('/', auth(['CANDIDATE']), getFeedController);
feedRouter.post('/posts', auth(['CANDIDATE']), createFeedPostController);
feedRouter.delete('/posts/:postId', auth(['CANDIDATE']), deleteFeedPostController);
