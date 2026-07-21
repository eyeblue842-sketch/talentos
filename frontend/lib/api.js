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

export async function getRecruiterOnboardingState() {
  const token = await requireToken();
  const response = await requestBackend('/organisations/current/onboarding', { method: 'GET' }, token);
  return response.data;
}

export async function completeRecruiterOnboarding(payload) {
  const token = await requireToken();
  const response = await requestBackend('/organisations/current/onboarding', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getOrganisationMembers() {
  const token = await requireToken();
  const response = await requestBackend('/organisations/members', { method: 'GET' }, token);
  return response.data;
}

export async function getOrganisationInvitations() {
  const token = await requireToken();
  const response = await requestBackend('/organisations/invitations', { method: 'GET' }, token);
  return response.data;
}

export async function createOrganisationInvitation(payload) {
  const token = await requireToken();
  const response = await requestBackend('/organisations/invitations', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function resendOrganisationInvitation(invitationId) {
  const token = await requireToken();
  const response = await requestBackend(`/organisations/invitations/${invitationId}/resend`, {
    method: 'POST',
  }, token);
  return response.data;
}

export async function revokeOrganisationInvitation(invitationId) {
  const token = await requireToken();
  const response = await requestBackend(`/organisations/invitations/${invitationId}/revoke`, {
    method: 'POST',
  }, token);
  return response.data;
}

export async function getInvitationTokenDetail(tokenValue) {
  const response = await requestBackend(`/organisations/invitations/token/${tokenValue}`, { method: 'GET' });
  return response.data;
}

export async function acceptOrganisationInvitation(tokenValue) {
  const token = await requireToken();
  const response = await requestBackend('/organisations/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token: tokenValue }),
  }, token);
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
    meta: response.meta || {},
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

export async function getPublicJobApplyContext(slug) {
  const token = await getSessionToken();
  const response = await requestBackend(`/public/jobs/${slug}/apply`, { method: 'GET' }, token);
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

export async function getCandidateRecommendations(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/recommendations${buildQueryString(filters)}`, { method: 'GET' }, token);
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

export async function getRecruiterCandidatePreview(candidateId) {
  const token = await requireToken();
  const response = await requestBackend(`/resumes/preview/${candidateId}`, { method: 'GET' }, token);
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

export async function getRecruiterSavedSearches() {
  const token = await requireToken();
  const response = await requestBackend('/resumes/saved-searches', { method: 'GET' }, token);
  return {
    items: response.data,
    recent: response.meta?.recent || [],
  };
}

export async function getRecruiterTalentPools() {
  const token = await requireToken();
  const response = await requestBackend('/resumes/talent-pools', { method: 'GET' }, token);
  return response.data;
}

export async function addResumeSearchCandidatesToAts(payload) {
  const token = await requireToken();
  const response = await requestBackend('/ats/resume-search/add', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function shortlistResumeSearchCandidates(payload) {
  const token = await requireToken();
  const response = await requestBackend('/ats/resume-search/shortlist', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function emailResumeSearchCandidates(payload) {
  const token = await requireToken();
  const response = await requestBackend('/ats/resume-search/email', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function tagResumeSearchCandidates(payload) {
  const token = await requireToken();
  const response = await requestBackend('/ats/resume-search/tag', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function createRecruiterTalentPool(payload) {
  const token = await requireToken();
  const response = await requestBackend('/resumes/talent-pools', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function addCandidatesToTalentPool(payload) {
  const token = await requireToken();
  const response = await requestBackend(`/resumes/talent-pools/${payload.poolId}/candidates`, {
    method: 'POST',
    body: JSON.stringify({ candidateIds: payload.candidateIds }),
  }, token);
  return response.data;
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

export async function getCandidateApplications(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/applications${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getCandidateApplication(applicationId) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/applications/${applicationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateApplicationWithdrawal(applicationId) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/applications/${applicationId}/withdrawal`, { method: 'GET' }, token);
  return response.data;
}

export async function withdrawCandidateApplication(applicationId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/applications/${applicationId}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateResumeAssets() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/resumes', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateRecentJobs(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/recent-jobs${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function recordCandidateRecentJob(jobId, payload = {}) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/recent-jobs', {
    method: 'POST',
    body: JSON.stringify({ jobId, ...payload }),
  }, token);
  return response.data;
}

export async function clearCandidateRecentJobs() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/recent-jobs', {
    method: 'DELETE',
  }, token);
  return response.data;
}

export async function getRecruiterScreeningTemplates(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/jobs/screening-templates${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterApplicationsV2(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/ats/applications${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getRecruiterApplicationV2(applicationId) {
  const token = await requireToken();
  const response = await requestBackend(`/ats/applications/${applicationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function createOfferDraft(payload) {
  const token = await requireToken();
  const response = await requestBackend('/offers', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getRecruiterOffersByApplication(applicationId) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/application/${applicationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getRecruiterOffer(offerId) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/${offerId}`, { method: 'GET' }, token);
  return response.data;
}

export async function updateRecruiterOffer(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/${offerId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function requestRecruiterOfferApproval(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/${offerId}/request-approval`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function actOnRecruiterOfferApproval(offerId, approvalId, action, payload) {
  const token = await requireToken();
  const path = action === 'APPROVED'
    ? `/offers/${offerId}/approvals/${approvalId}/approve`
    : action === 'CHANGES_REQUESTED'
      ? `/offers/${offerId}/approvals/${approvalId}/request-changes`
      : `/offers/${offerId}/approvals/${approvalId}/reject`;
  const response = await requestBackend(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function releaseRecruiterOffer(offerId, payload = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/${offerId}/release`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function createRecruiterOfferRevision(payload) {
  const token = await requireToken();
  const response = await requestBackend('/offers/revisions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function withdrawRecruiterOffer(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/${offerId}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function updateRecruiterOfferJoining(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/${offerId}/joining`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateOfferForApplication(applicationId) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/candidate/application/${applicationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateOffer(offerId) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/candidate/${offerId}`, { method: 'GET' }, token);
  return response.data;
}

export async function acceptCandidateOfferResponse(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/candidate/${offerId}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function rejectCandidateOfferResponse(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/candidate/${offerId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function requestCandidateOfferRevisionResponse(offerId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/offers/candidate/${offerId}/revision-request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getPublicOfferAccess(tokenValue) {
  const response = await requestBackend(`/offers/access/${tokenValue}`, { method: 'GET' });
  return response.data;
}

export async function acceptPublicOfferAccess(tokenValue, payload) {
  const response = await requestBackend(`/offers/access/${tokenValue}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function rejectPublicOfferAccess(tokenValue, payload) {
  const response = await requestBackend(`/offers/access/${tokenValue}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function requestPublicOfferRevision(tokenValue, payload) {
  const response = await requestBackend(`/offers/access/${tokenValue}/revision-request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}
