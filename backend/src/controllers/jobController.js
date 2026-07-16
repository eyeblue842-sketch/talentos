import {
  createJob,
  listRecruiterJobs,
  updateJob,
  deleteJob,
  browseJobs,
} from '../services/jobService.js';
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
    const jobs = await listRecruiterJobs(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, jobs);
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
    const jobs = await browseJobs(req.query);
    sendSuccess(res, 200, jobs);
  } catch (error) {
    next(error);
  }
}
