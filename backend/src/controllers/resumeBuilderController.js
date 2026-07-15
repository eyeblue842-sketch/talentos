import { upsertResumeBuilder, getResumeBuilder } from '../services/resumeBuilderService.js';
import { sendSuccess } from '../utils/response.js';

export async function saveResumeBuilder(req, res, next) {
  try {
    const resume = await upsertResumeBuilder(req.user.candidateProfile.id, req.body);
    sendSuccess(res, 200, resume);
  } catch (error) {
    next(error);
  }
}

export async function getResumeBuilderState(req, res, next) {
  try {
    const resume = await getResumeBuilder(req.user.candidateProfile.id);
    sendSuccess(res, 200, resume);
  } catch (error) {
    next(error);
  }
}
