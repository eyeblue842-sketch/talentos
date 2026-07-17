import {
  addJobQuestionFromLibrary,
  addJobScreeningQuestion,
  archiveScreeningTemplate,
  createScreeningTemplate,
  duplicateJobScreeningQuestion,
  duplicateScreeningTemplate,
  getCandidateApplicationDetail,
  getOwnedResumeDownload,
  getPublicJobApplyContext,
  getRecruiterAnswerFileDownload,
  getRecruiterApplicationResumeDownload,
  getRecruiterJobApplicationDetail,
  listCandidateJobApplications,
  listCandidateResumeAssets,
  listJobScreeningQuestions,
  listRecruiterJobApplications,
  listScreeningTemplates,
  previewJobQuestions,
  removeJobScreeningQuestion,
  reorderJobScreeningQuestions,
  submitJobApplication,
  updateJobScreeningQuestion,
  updateScreeningTemplate,
  uploadCandidateResumeAsset,
  validateApplicationAnswers,
} from '../services/applicationWorkflowService.js';
import { sendSuccess } from '../utils/response.js';

function pipeDownload(res, filename, mimeType, contentLength, stream) {
  if (mimeType) res.setHeader('Content-Type', mimeType);
  if (contentLength) res.setHeader('Content-Length', String(contentLength));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  stream.pipe(res);
}

export async function getPublicJobApplyData(req, res, next) {
  try {
    const result = await getPublicJobApplyContext(req.params.slug, req.user || null);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getQuestionTemplates(req, res, next) {
  try {
    const result = await listScreeningTemplates(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function postQuestionTemplate(req, res, next) {
  try {
    const result = await createScreeningTemplate(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function patchQuestionTemplate(req, res, next) {
  try {
    const result = await updateScreeningTemplate(req.user, req.params.templateId, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postQuestionTemplateArchive(req, res, next) {
  try {
    const result = await archiveScreeningTemplate(req.user, req.params.templateId, req.body.isActive, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postQuestionTemplateDuplicate(req, res, next) {
  try {
    const result = await duplicateScreeningTemplate(req.user, req.params.templateId, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getJobQuestions(req, res, next) {
  try {
    const result = await listJobScreeningQuestions(req.user, req.params.jobId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postJobQuestion(req, res, next) {
  try {
    const result = await addJobScreeningQuestion(req.user, req.params.jobId, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postJobQuestionFromLibrary(req, res, next) {
  try {
    const result = await addJobQuestionFromLibrary(req.user, req.params.jobId, req.body.templateId, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function patchJobQuestion(req, res, next) {
  try {
    const result = await updateJobScreeningQuestion(req.user, req.params.jobId, req.params.questionId, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postJobQuestionReorder(req, res, next) {
  try {
    const result = await reorderJobScreeningQuestions(req.user, req.params.jobId, req.body.questionIds, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postJobQuestionDuplicate(req, res, next) {
  try {
    const result = await duplicateJobScreeningQuestion(req.user, req.params.jobId, req.params.questionId, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteJobQuestion(req, res, next) {
  try {
    const result = await removeJobScreeningQuestion(req.user, req.params.jobId, req.params.questionId, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getJobQuestionPreview(req, res, next) {
  try {
    const result = await previewJobQuestions(req.user, req.params.jobId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateResumes(req, res, next) {
  try {
    const result = await listCandidateResumeAssets(req.user);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateResume(req, res, next) {
  try {
    const result = await uploadCandidateResumeAsset(req.user, req.file, { kind: 'RESUME' });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateAnswerFile(req, res, next) {
  try {
    const result = await uploadCandidateResumeAsset(req.user, req.file, { kind: 'SCREENING_FILE' });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function validateCandidateApplication(req, res, next) {
  try {
    const result = await validateApplicationAnswers(req.user, req.body);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function submitCandidateApplication(req, res, next) {
  try {
    const result = await submitJobApplication(req.user, req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateApplicationsV2(req, res, next) {
  try {
    const result = await listCandidateJobApplications(req.user);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateApplicationV2(req, res, next) {
  try {
    const result = await getCandidateApplicationDetail(req.user, req.params.applicationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadCandidateResumeFile(req, res, next) {
  try {
    const result = await getOwnedResumeDownload(req.user, req.params.assetId);
    pipeDownload(res, result.asset.originalFilename, result.asset.mimeType, result.file.contentLength, result.file.stream);
  } catch (error) {
    next(error);
  }
}

export async function getRecruiterApplicationsV2(req, res, next) {
  try {
    const result = await listRecruiterJobApplications(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getRecruiterApplicationV2(req, res, next) {
  try {
    const result = await getRecruiterJobApplicationDetail(req.user, req.params.applicationId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadRecruiterApplicationResume(req, res, next) {
  try {
    const result = await getRecruiterApplicationResumeDownload(req.user, req.params.applicationId, req.user.activeMembership?.organisationId);
    pipeDownload(res, result.snapshot.filename, result.snapshot.mimeType, result.file.contentLength, result.file.stream);
  } catch (error) {
    next(error);
  }
}

export async function downloadRecruiterAnswerFile(req, res, next) {
  try {
    const result = await getRecruiterAnswerFileDownload(req.user, req.params.assetId, req.query.applicationId, req.user.activeMembership?.organisationId);
    pipeDownload(res, result.asset.originalFilename, result.asset.mimeType, result.file.contentLength, result.file.stream);
  } catch (error) {
    next(error);
  }
}
