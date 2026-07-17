import { getSessionToken, requestBackend } from '@/lib/auth';
import { buildQueryString } from '@/lib/query-internal';

async function requireToken() {
  const token = await getSessionToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  return token;
}

export async function getRecruiterDashboard() {
  const token = await requireToken();
  const response = await requestBackend('/dashboard/recruiter', { method: 'GET' }, token);
  return response.data;
}

export async function getCurrentOrganisation() {
  const token = await requireToken();
  const response = await requestBackend('/organisations/current', { method: 'GET' }, token);
  return response.data;
}

export async function getOrganisationMembers() {
  const token = await requireToken();
  const response = await requestBackend('/organisations/members', { method: 'GET' }, token);
  return response.data;
}

export async function getRequisitions() {
  const token = await requireToken();
  const response = await requestBackend('/requisitions', { method: 'GET' }, token);
  return response.data;
}

export async function getApprovedRequisitions() {
  const response = await getRequisitions();
  return (response || []).filter((item) => item.approvalStatus === 'APPROVED');
}

export async function getNotifications() {
  const token = await requireToken();
  const response = await requestBackend('/notifications', { method: 'GET' }, token);
  return response.data;
}

export async function searchCandidates(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/resumes/search${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getPublicPortal() {
  const token = await getSessionToken();
  const response = await requestBackend('/public/portal', { method: 'GET' }, token);
  return response.data;
}

export async function getPublicJobs(filters = {}) {
  const token = await getSessionToken();
  const response = await requestBackend(`/public/jobs${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getPublicJob(slug) {
  const token = await getSessionToken();
  const response = await requestBackend(`/public/jobs/${slug}`, { method: 'GET' }, token);
  return response.data;
}

export async function getPublicOrganisation(slug, filters = {}) {
  const token = await getSessionToken();
  const response = await requestBackend(`/public/companies/${slug}${buildQueryString(filters)}`, { method: 'GET' }, token);
  return response.data;
}

export async function getPublicOrganisations() {
  const token = await getSessionToken();
  const response = await requestBackend('/public/companies', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateDashboard() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/dashboard', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateProfile() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/profile', { method: 'GET' }, token);
  return response.data;
}

export async function updateCandidateProfile(payload) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateSettings() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/settings', { method: 'GET' }, token);
  return response.data;
}

export async function updateCandidateSettings(payload) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateSavedJobs(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/saved-jobs${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function saveCandidateJob(jobId) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/saved-jobs', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  }, token);
  return response.data;
}

export async function unsaveCandidateJob(jobId) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/saved-jobs/${jobId}`, {
    method: 'DELETE',
  }, token);
  return response.data;
}

export async function getCandidateNotifications(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/notifications${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function markCandidateNotificationRead(notificationId) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ notificationId }),
  }, token);
  return response.data;
}

export async function markAllCandidateNotificationsRead() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/notifications/read-all', {
    method: 'POST',
  }, token);
  return response.data;
}

export async function getCandidateRecommendations() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/recommendations', { method: 'GET' }, token);
  return response.data;
}

export async function getRecruiterJobs() {
  const token = await requireToken();
  const response = await requestBackend('/jobs', { method: 'GET' }, token);
  return response.data;
}

export async function getRecruiterJobsPage(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/jobs${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterJob(jobId) {
  const token = await requireToken();
  const response = await requestBackend(`/jobs/${jobId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateDetail(candidateId) {
  const token = await requireToken();
  const response = await requestBackend(`/resumes/search/${candidateId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getSavedCandidates(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/resumes/saved${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterPipeline() {
  const token = await requireToken();
  const response = await requestBackend('/ats/pipeline', { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterPipelinePage(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/ats/pipeline${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterApplication(applicationId) {
  const token = await requireToken();
  const response = await requestBackend(`/ats/pipeline/${applicationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateApplications() {
  const token = await requireToken();
  const response = await requestBackend('/ats/applications', { method: 'GET' }, token);
  return response.data;
}
