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

export async function getCurrentOrganisation() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/organisations/current', { method: 'GET' }, token);
  return response.data;
}

export async function getOrganisationMembers() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/organisations/members', { method: 'GET' }, token);
  return response.data;
}

export async function getRequisitions() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/requisitions', { method: 'GET' }, token);
  return response.data;
}

export async function getApprovedRequisitions() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/requisitions', { method: 'GET' }, token);
  return (response.data || []).filter((item) => item.approvalStatus === 'APPROVED');
}

export async function getNotifications() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/notifications', { method: 'GET' }, token);
  return response.data;
}

export async function searchCandidates(query = '') {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const suffix = query ? `?${query}` : '';
  const response = await requestBackend(`/resumes/search${suffix}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
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

export async function getRecruiterJobsPage(query = '') {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend(`/jobs${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterJob(jobId) {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend(`/jobs/${jobId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateDetail(candidateId) {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend(`/resumes/search/${candidateId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getSavedCandidates(query = '') {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend(`/resumes/saved${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterPipeline() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend('/ats/pipeline', { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterPipelinePage(query = '') {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend(`/ats/pipeline${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterApplication(applicationId) {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const response = await requestBackend(`/ats/pipeline/${applicationId}`, { method: 'GET' }, token);
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
