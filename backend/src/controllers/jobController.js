import {
  createJob,
  listRecruiterJobs,
  updateJob,
  deleteJob,
  browseJobs,
} from '../services/jobService.js';

export async function createRecruiterJob(req, res, next) {
  try {
    const job = await createJob(req.user.id, req.body);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
}

export async function getRecruiterJobs(req, res, next) {
  try {
    const jobs = await listRecruiterJobs(req.user.id);
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
}

export async function editRecruiterJob(req, res, next) {
  try {
    const job = await updateJob(req.params.jobId, req.user.id, req.body);
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
}

export async function removeRecruiterJob(req, res, next) {
  try {
    await deleteJob(req.params.jobId, req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function getPublicJobs(req, res, next) {
  try {
    const jobs = await browseJobs(req.query);
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
}
