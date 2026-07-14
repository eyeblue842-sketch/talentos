import {
  applyToJob,
  getRecruiterPipeline,
  updatePipelineStage,
  scheduleInterview,
  addAtsNote,
  getCandidateApplications,
} from '../services/atsService.js';

export async function applyForJob(req, res, next) {
  try {
    const application = await applyToJob(req.user.candidateProfile.id, req.body);
    res.status(201).json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
}

export async function getPipeline(req, res, next) {
  try {
    const pipeline = await getRecruiterPipeline(req.user.id);
    res.json({ success: true, data: pipeline });
  } catch (error) {
    next(error);
  }
}

export async function movePipelineStage(req, res, next) {
  try {
    const updated = await updatePipelineStage(req.params.applicationId, req.user.id, req.body.stage);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function planInterview(req, res, next) {
  try {
    const updated = await scheduleInterview(req.params.applicationId, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function createAtsNote(req, res, next) {
  try {
    const note = await addAtsNote(req.params.applicationId, req.user.id, req.body.content);
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateApplicationList(req, res, next) {
  try {
    const applications = await getCandidateApplications(req.user.candidateProfile.id);
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
}
