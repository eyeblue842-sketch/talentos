import {
  createJob,
  getJobDetail,
  listRecruiterJobs,
  updateJob,
  updateJobStatus,
  deleteJob,
} from '../services/jobService.js';
import { searchPublicJobs } from '../services/publicPortalService.js';
import { sendSuccess } from '../utils/response.js';

export async function createRecruiterJob(req, res, next) {
  try {
    const job = await createJob(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, job);
  } catch (error) {
    next(error);
  }
}

export async function getRecruiterJobs(req, res, next) {
  try {
    const result = await listRecruiterJobs(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getRecruiterJobDetail(req, res, next) {
  try {
    const job = await getJobDetail(req.user, req.params.jobId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, job);
  } catch (error) {
    next(error);
  }
}

export async function editRecruiterJob(req, res, next) {
  try {
    const job = await updateJob(req.params.jobId, req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, job);
  } catch (error) {
    next(error);
  }
}

export async function changeRecruiterJobStatus(req, res, next) {
  try {
    const job = await updateJobStatus(req.params.jobId, req.user, req.body.status, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, job);
  } catch (error) {
    next(error);
  }
}

export async function removeRecruiterJob(req, res, next) {
  try {
    const result = await deleteJob(req.params.jobId, req.user, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getPublicJobs(req, res, next) {
  try {
    const result = await searchPublicJobs(req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}
