import { getSessionToken, requestBackend } from '@/lib/auth';

export async function getRecruiterDashboard() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/dashboard/recruiter', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateDashboard() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/dashboard/candidate', { method: 'GET' }, token);
  return response.data;
}

export async function getPublicJobs() {
  const response = await requestBackend('/jobs/public', { method: 'GET' });
  return response.data;
}

export async function getRecruiterJobs() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/jobs', { method: 'GET' }, token);
  return response.data;
}

export async function getRecruiterPipeline() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/ats/pipeline', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateApplications() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/ats/applications', { method: 'GET' }, token);
  return response.data;
}
