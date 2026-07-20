import {
  addCandidatesToAts,
  applyToJob,
  cancelInterview,
  emailCandidatesFromResumeSearch,
  getApplicationDetail,
  getRecruiterPipeline,
  updatePipelineStage,
  scheduleInterview,
  addAtsNote,
  updateAtsNote,
  deleteAtsNote,
  getCandidateApplications,
  shortlistCandidatesFromResumeSearch,
  tagCandidatesFromResumeSearch,
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
    const pipeline = await getRecruiterPipeline(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, pipeline.items, { stageGroups: pipeline.stageGroups });
  } catch (error) {
    next(error);
  }
}

export async function getPipelineApplication(req, res, next) {
  try {
    const application = await getApplicationDetail(req.user, req.params.applicationId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, application);
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

export async function cancelPlannedInterview(req, res, next) {
  try {
    const updated = await cancelInterview(
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

export async function editAtsNote(req, res, next) {
  try {
    const note = await updateAtsNote(
      req.params.applicationId,
      req.params.noteId,
      req.user,
      req.body.content,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, note);
  } catch (error) {
    next(error);
  }
}

export async function removeAtsNote(req, res, next) {
  try {
    const result = await deleteAtsNote(
      req.params.applicationId,
      req.params.noteId,
      req.user,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, result);
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

export async function addResumeSearchCandidatesToAts(req, res, next) {
  try {
    const result = await addCandidatesToAts(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function shortlistResumeSearchCandidates(req, res, next) {
  try {
    const result = await shortlistCandidatesFromResumeSearch(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function emailResumeSearchCandidates(req, res, next) {
  try {
    const result = await emailCandidatesFromResumeSearch(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function tagResumeSearchCandidates(req, res, next) {
  try {
    const result = await tagCandidatesFromResumeSearch(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
