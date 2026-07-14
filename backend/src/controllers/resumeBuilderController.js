import { upsertResumeBuilder, getResumeBuilder } from '../services/resumeBuilderService.js';

export async function saveResumeBuilder(req, res, next) {
  try {
    const resume = await upsertResumeBuilder(req.user.candidateProfile.id, req.body);
    res.json({ success: true, data: resume });
  } catch (error) {
    next(error);
  }
}

export async function getResumeBuilderState(req, res, next) {
  try {
    const resume = await getResumeBuilder(req.user.candidateProfile.id);
    res.json({ success: true, data: resume });
  } catch (error) {
    next(error);
  }
}
