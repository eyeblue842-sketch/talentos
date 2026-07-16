import {
  applyToJob,
  getRecruiterPipeline,
  updatePipelineStage,
  scheduleInterview,
  addAtsNote,
  getCandidateApplications,
} from '../services/atsService.js';
import { sendSuccess } from '../utils/response.js';

export async function applyForJob(req, res, next) {
  try {
    const application = await applyToJob(req.user.candidateProfile.id, req.body);
    sendSuccess(res, 201, application);
  } catch (error) {
    next(error);
  }
}

export async function getPipeline(req, res, next) {
  try {
    const pipeline = await getRecruiterPipeline(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, pipeline);
  } catch (error) {
    next(error);
  }
}

export async function movePipelineStage(req, res, next) {
  try {
    const updated = await updatePipelineStage(
      req.params.applicationId,
      req.user,
      req.body.stage,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, updated);
  } catch (error) {
    next(error);
  }
}

export async function planInterview(req, res, next) {
  try {
    const updated = await scheduleInterview(
      req.params.applicationId,
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, updated);
  } catch (error) {
    next(error);
  }
}

export async function createAtsNote(req, res, next) {
  try {
    const note = await addAtsNote(
      req.params.applicationId,
      req.user,
      req.body.content,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 201, note);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateApplicationList(req, res, next) {
  try {
    const applications = await getCandidateApplications(req.user.candidateProfile.id);
    sendSuccess(res, 200, applications);
  } catch (error) {
    next(error);
  }
}
