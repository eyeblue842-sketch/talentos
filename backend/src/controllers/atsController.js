import {
  addCandidatesToAts,
  applyToJob,
  cancelInterview,
  createAtsOpening,
  createCandidateInvite,
  emailCandidatesFromResumeSearch,
  getApplicationDetail,
  getRecruiterAtsOpenings,
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
import {
  listAssessmentTemplates,
  createAssessmentTemplate,
  updateAssessmentTemplate,
  deleteAssessmentTemplate,
} from '../services/assessmentTemplateService.js';
import {
  listOfferTemplates,
  createOfferTemplate,
  updateOfferTemplate,
  deleteOfferTemplate,
  uploadOfferTemplateDocument,
} from '../services/offerTemplateService.js';
import { sendSuccess } from '../utils/response.js';

export async function getOfferTemplates(req, res, next) {
  try {
    const templates = await listOfferTemplates(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, templates);
  } catch (error) {
    next(error);
  }
}

export async function postOfferTemplate(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const template = await createOfferTemplate(req.user, req.body, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 201, template);
  } catch (error) {
    next(error);
  }
}

export async function patchOfferTemplate(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const template = await updateOfferTemplate(req.user, req.params.templateId, req.body, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 200, template);
  } catch (error) {
    next(error);
  }
}

export async function removeOfferTemplate(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const result = await deleteOfferTemplate(req.user, req.params.templateId, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postOfferTemplateDocument(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const template = await uploadOfferTemplateDocument(req.user, req.params.templateId, req.file, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 200, template);
  } catch (error) {
    next(error);
  }
}

export async function getAssessmentTemplates(req, res, next) {
  try {
    const templates = await listAssessmentTemplates(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, templates);
  } catch (error) {
    next(error);
  }
}

export async function postAssessmentTemplate(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const template = await createAssessmentTemplate(req.user, req.body, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 201, template);
  } catch (error) {
    next(error);
  }
}

export async function patchAssessmentTemplate(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const template = await updateAssessmentTemplate(req.user, req.params.templateId, req.body, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 200, template);
  } catch (error) {
    next(error);
  }
}

export async function removeAssessmentTemplate(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const result = await deleteAssessmentTemplate(req.user, req.params.templateId, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

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

export async function getAtsOpenings(req, res, next) {
  try {
    const openings = await getRecruiterAtsOpenings(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, openings);
  } catch (error) {
    next(error);
  }
}

export async function postAtsOpening(req, res, next) {
  try {
    const opening = await createAtsOpening(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, opening);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateInvite(req, res, next) {
  try {
    const result = await createCandidateInvite(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
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
