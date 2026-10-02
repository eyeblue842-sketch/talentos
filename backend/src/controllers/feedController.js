import { createFeedPost, deleteFeedPost, getCandidateFeed } from '../services/feedService.js';
import { sendSuccess } from '../utils/response.js';

export async function getFeedController(req, res, next) {
  try {
    const feed = await getCandidateFeed(req.user, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    sendSuccess(res, 200, feed);
  } catch (error) {
    next(error);
  }
}

export async function createFeedPostController(req, res, next) {
  try {
    const post = await createFeedPost(req.user, req.body);
    sendSuccess(res, 201, post);
  } catch (error) {
    next(error);
  }
}

export async function deleteFeedPostController(req, res, next) {
  try {
    const result = await deleteFeedPost(req.user, req.params.postId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
