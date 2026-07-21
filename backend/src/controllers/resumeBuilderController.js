import { upsertResumeBuilder, getResumeBuilder } from '../services/resumeBuilderService.js';
import { sendSuccess } from '../utils/response.js';

export async function saveResumeBuilder(req, res, next) {
  try {
    const resume = await upsertResumeBuilder(req.user, req.body, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, resume);
  } catch (error) {
    next(error);
  }
}

export async function getResumeBuilderState(req, res, next) {
  try {
    const resume = await getResumeBuilder(req.user);
    sendSuccess(res, 200, resume);
  } catch (error) {
    next(error);
  }
}
