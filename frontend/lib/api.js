import 'server-only';
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

export async function getInitialSetupStatus() {
  const response = await requestBackend('/setup/status', { method: 'GET' });
  return response.data;
}

export async function submitInitialSetup(payload) {
  const response = await requestBackend('/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function resetInitialSetup(password) {
  const token = await requireToken();
  const response = await requestBackend('/setup/reset', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }, token);
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

export async function getOrganisationAuditLogs() {
  const token = await requireToken();
  const response = await requestBackend('/organisations/audit-logs', { method: 'GET' }, token);
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

export async function getNetworkConnections(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/network/connections${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function getNetworkReceivedRequests(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/network/requests/received${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function getNetworkSentRequests(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/network/requests/sent${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function getNetworkSuggestions(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/network/suggestions${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function searchNetworkPeople(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/network/search${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function sendNetworkRequest(payload) {
  const token = await requireToken();
  const response = await requestBackend('/network/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function acceptNetworkRequest(requestId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/requests/${requestId}/accept`, { method: 'POST' }, token);
  return response.data;
}

export async function declineNetworkRequest(requestId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/requests/${requestId}/decline`, { method: 'POST' }, token);
  return response.data;
}

export async function withdrawNetworkRequest(requestId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/requests/${requestId}`, { method: 'DELETE' }, token);
  return response.data;
}

export async function removeNetworkConnection(connectionId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/connections/${connectionId}`, { method: 'DELETE' }, token);
  return response.data;
}

export async function blockNetworkUser(userId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/users/${userId}/block`, { method: 'POST' }, token);
  return response.data;
}

export async function unblockNetworkUser(userId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/users/${userId}/block`, { method: 'DELETE' }, token);
  return response.data;
}

export async function getNetworkMutualConnections(userId, filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/network/users/${userId}/mutual${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function getProfessionalProfile(userId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/people/${userId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getNetworkPrivacy() {
  const token = await requireToken();
  const response = await requestBackend('/network/privacy', { method: 'GET' }, token);
  return response.data;
}

export async function updateNetworkPrivacy(payload) {
  const token = await requireToken();
  const response = await requestBackend('/network/privacy', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function followCompany(organisationId) {
  const token = await requireToken();
  const response = await requestBackend('/network/company-follows', {
    method: 'POST',
    body: JSON.stringify({ organisationId }),
  }, token);
  return response.data;
}

export async function unfollowCompany(organisationId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/company-follows/${organisationId}`, { method: 'DELETE' }, token);
  return response.data;
}

export async function getCompanyFollowStatus(organisationId) {
  const token = await requireToken();
  const response = await requestBackend(`/network/company-follows/${organisationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getMessageConversations(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/messages/conversations${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function createMessageConversation(participantUserId) {
  const token = await requireToken();
  const response = await requestBackend('/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({ participantUserId }),
  }, token);
  return response.data;
}

export async function getMessageConversation(conversationId) {
  const token = await requireToken();
  const response = await requestBackend(`/messages/conversations/${conversationId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getConversationMessages(conversationId, filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/messages/conversations/${conversationId}/messages${buildQueryString(filters)}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function markConversationRead(conversationId, payload = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/messages/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getMessageUnreadCount() {
  const token = await requireToken();
  const response = await requestBackend('/messages/unread-count', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateDashboard() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/dashboard', { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateOnboarding() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/onboarding', { method: 'GET' }, token);
  return response.data;
}

export async function saveCandidateOnboarding(payload) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/onboarding', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
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

export async function getCandidateInterviews() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/interviews', { method: 'GET' }, token);
  return response.data;
}

export async function requestCandidateInterviewReschedule(roundId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/interviews/${roundId}/reschedule-request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function withdrawCandidateInterviewReschedule(requestId) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/interviews/reschedule-request/withdraw', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  }, token);
  return response.data;
}

export async function getCandidateOffers() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/offers', { method: 'GET' }, token);
  return response.data;
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

export async function getAssignedInterviewMeetings() {
  const token = await requireToken();
  const response = await requestBackend('/interviews/assigned', { method: 'GET' }, token);
  return response.data;
}

export async function getRecruiterInterviewMeetings(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/interviews/meetings${buildQueryString(filters)}`, { method: 'GET' }, token);
  return response.data;
}

export async function getRecruiterInterviewMeeting(roundId) {
  const token = await requireToken();
  const response = await requestBackend(`/interviews/rounds/${roundId}/meeting`, { method: 'GET' }, token);
  return response.data;
}

export async function checkRecruiterInterviewAvailability(payload) {
  const token = await requireToken();
  const response = await requestBackend('/interviews/availability', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function requestInterviewerReschedule(roundId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/interviews/rounds/${roundId}/reschedule-request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function reviewInterviewRescheduleRequest(requestId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/interviews/reschedule-requests/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function withdrawInterviewerReschedule(requestId) {
  const token = await requireToken();
  const response = await requestBackend('/interviews/reschedule-requests/withdraw', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  }, token);
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

export async function updateCandidateResumeAssetState(assetId, action) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/resumes/${assetId}/state`, {
    method: 'POST',
    body: JSON.stringify({ assetId, action }),
  }, token);
  return response.data;
}

export async function applyCandidateResumeParsedUpdates(assetId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/candidate/resumes/${assetId}/apply-parsed`, {
    method: 'POST',
    body: JSON.stringify({ assetId, ...payload }),
  }, token);
  return response.data;
}

export async function getResumeBuilderState() {
  const token = await requireToken();
  const response = await requestBackend('/resume-builder', { method: 'GET' }, token);
  return response.data;
}

export async function saveResumeBuilderLink(payload) {
  const token = await requireToken();
  const response = await requestBackend('/resume-builder', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateDataExport() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/data-export', { method: 'GET' }, token);
  return response.data;
}

export async function requestCandidateAccountDeactivation(payload) {
  const token = await requireToken();
  const response = await requestBackend('/candidate/account-deactivation', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
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

export async function getAdminOverview() {
  const token = await requireToken();
  const response = await requestBackend('/admin/overview', { method: 'GET' }, token);
  return response.data;
}

export async function getAdminOrganisation() {
  const token = await requireToken();
  const response = await requestBackend('/admin/organisation', { method: 'GET' }, token);
  return response.data;
}

export async function updateAdminOrganisation(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/organisation', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function archiveAdminOrganisation(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/organisation/archive', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function saveAdminOrganisationUnit(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/organisation/units', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function archiveAdminOrganisationUnit(unitId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/admin/organisation/units/${unitId}/archive`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAdminUsers(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/admin/users${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function updateAdminUserMembership(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/users/membership', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function bulkInviteAdminUsers(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/users/bulk-invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function bulkUpdateAdminUsers(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/users/bulk-update', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function transferAdminOwnership(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/users/transfer-ownership', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAdminRoles() {
  const token = await requireToken();
  const response = await requestBackend('/admin/roles', { method: 'GET' }, token);
  return response.data;
}

export async function saveAdminRole(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAdminSettings() {
  const token = await requireToken();
  const response = await requestBackend('/admin/settings', { method: 'GET' }, token);
  return response.data;
}

export async function updateAdminSettings(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getMeetingProviders() {
  const token = await requireToken();
  const response = await requestBackend('/meeting-providers/admin/providers', { method: 'GET' }, token);
  return response.data;
}

export async function beginMeetingProviderConnect(provider) {
  const token = await requireToken();
  const response = await requestBackend(`/meeting-providers/admin/providers/${provider}/connect`, {
    method: 'POST',
  }, token);
  return response.data;
}

export async function validateMeetingProvider(provider) {
  const token = await requireToken();
  const response = await requestBackend(`/meeting-providers/admin/providers/${provider}/validate`, {
    method: 'POST',
  }, token);
  return response.data;
}

export async function disconnectMeetingProvider(provider) {
  const token = await requireToken();
  const response = await requestBackend(`/meeting-providers/admin/providers/${provider}`, {
    method: 'DELETE',
  }, token);
  return response.data;
}

export async function getAdminWorkflow() {
  const token = await requireToken();
  const response = await requestBackend('/admin/workflow', { method: 'GET' }, token);
  return response.data;
}

export async function updateAdminWorkflow(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/workflow', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAdminAudit(query = '') {
  const token = await requireToken();
  const response = await requestBackend(`/admin/audit${query ? `?${query}` : ''}`, { method: 'GET' }, token);
  return { items: response.data, meta: response.meta };
}

export async function getAdminNotificationTemplates() {
  const token = await requireToken();
  const response = await requestBackend('/admin/notification-templates', { method: 'GET' }, token);
  return response.data;
}

export async function saveAdminNotificationTemplate(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/notification-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAdminBackgroundJobs() {
  const token = await requireToken();
  const response = await requestBackend('/admin/background-jobs', { method: 'GET' }, token);
  return response.data;
}

export async function getAdminAnalytics() {
  const token = await requireToken();
  const response = await requestBackend('/admin/analytics', { method: 'GET' }, token);
  return response.data;
}

export async function getAdminFeatureFlags() {
  const token = await requireToken();
  const response = await requestBackend('/admin/feature-flags', { method: 'GET' }, token);
  return response.data;
}

export async function saveAdminFeatureFlag(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/feature-flags', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAdminLookups() {
  const token = await requireToken();
  const response = await requestBackend('/admin/lookups', { method: 'GET' }, token);
  return response.data;
}

export async function updateAdminLookups(payload) {
  const token = await requireToken();
  const response = await requestBackend('/admin/lookups', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getIntelligenceGovernance() {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/governance', { method: 'GET' }, token);
  return response.data;
}

export async function getIntelligenceHealth() {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/health', { method: 'GET' }, token);
  return response.data;
}

export async function getResumeIntelligence(payload) {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/resume', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateMatchIntelligence(payload) {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/match', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getJobIntelligence(payload) {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/job', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function uploadCandidateProfilePhoto(file) {
  const token = await requireToken();
  const body = new FormData();
  body.set('photo', file);
  const response = await requestBackend('/candidate/profile-photo', {
    method: 'POST',
    body,
  }, token);
  return response.data;
}

export async function removeCandidateProfilePhoto() {
  const token = await requireToken();
  const response = await requestBackend('/candidate/profile-photo', {
    method: 'DELETE',
  }, token);
  return response.data;
}

export async function getJobDescriptionIntelligence(jobId, filters = {}) {
  const token = await requireToken();
  const query = buildQueryString(filters);
  const response = await requestBackend(`/intelligence/jobs/${jobId}${query}`, { method: 'GET' }, token);
  return response.data;
}

export async function getJobDescriptionIntelligenceStatus(jobId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/status`, { method: 'GET' }, token);
  return response.data;
}

export async function getJobDescriptionDrafts(jobId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/drafts`, { method: 'GET' }, token);
  return response.data;
}

export async function getJobDescriptionHistory(jobId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/history`, { method: 'GET' }, token);
  return response.data;
}

export async function getJobDescriptionTemplates() {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/job-description-templates', { method: 'GET' }, token);
  return response.data;
}

export async function getInterviewIntelligence(payload) {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/interview', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getAnalyticsInsight(payload) {
  const token = await requireToken();
  const response = await requestBackend('/intelligence/analytics/insight', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getResumeImportBatches(filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/resume-imports${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getResumeImportBatch(batchId) {
  const token = await requireToken();
  const response = await requestBackend(`/resume-imports/${batchId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getResumeImportBatchItems(batchId, filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/resume-imports/${batchId}/items${buildQueryString(filters)}`, { method: 'GET' }, token);
  return {
    items: response.data,
    meta: response.meta,
  };
}

export async function getResumeImportItem(batchId, itemId) {
  const token = await requireToken();
  const response = await requestBackend(`/resume-imports/${batchId}/items/${itemId}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateProfileIntelligence(candidateId, filters = {}) {
  const token = await requireToken();
  const query = buildQueryString(filters);
  const response = await requestBackend(`/intelligence/candidates/${candidateId}${query}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateProfileIntelligenceStatus(candidateId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/candidates/${candidateId}/status`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateJobMatch(jobId, candidateId, filters = {}) {
  const token = await requireToken();
  const query = buildQueryString(filters);
  const response = await requestBackend(`/intelligence/jobs/${jobId}/candidates/${candidateId}/match${query}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateJobMatchStatus(jobId, candidateId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/candidates/${candidateId}/match/status`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateJobMatchOverrides(jobId, candidateId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/candidates/${candidateId}/match/overrides`, { method: 'GET' }, token);
  return response.data;
}

export async function regenerateCandidateJobMatch(jobId, candidateId, payload = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/candidates/${candidateId}/match/regenerate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function createCandidateJobMatchOverride(jobId, candidateId, payload) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/candidates/${candidateId}/match/override`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function getCandidateRanking(jobId, filters = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/ranking${buildQueryString(filters)}`, { method: 'GET' }, token);
  return response.data;
}

export async function getCandidateRankingStatus(jobId) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/ranking/status`, { method: 'GET' }, token);
  return response.data;
}

export async function generateCandidateRanking(jobId, payload = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/ranking/generate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function refreshCandidateRanking(jobId, payload = {}) {
  const token = await requireToken();
  const response = await requestBackend(`/intelligence/jobs/${jobId}/ranking/refresh`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

// Subscriptions, Billing, Job Credits and Payment Gateway
// (feature/subscriptions-billing-entitlements)

export async function getBillingCatalogue() {
  const token = await getSessionToken();
  const response = await requestBackend('/billing/catalogue', { method: 'GET' }, token);
  return response.data;
}

export async function getBillingDashboard() {
  const token = await requireToken();
  const response = await requestBackend('/billing/dashboard', { method: 'GET' }, token);
  return response.data;
}

// Minimal, non-financial entitlement view for RECRUITER/HIRING_MANAGER
// (B2 hardening, section 1) - no GSTIN/address/invoices/payment
// references/purchase history reach this call.
export async function getBillingEntitlementSummary() {
  const token = await requireToken();
  const response = await requestBackend('/billing/entitlement-summary', { method: 'GET' }, token);
  return response.data;
}

export async function createBillingPurchaseIntent(productCode, idempotencyKey) {
  const token = await requireToken();
  const response = await requestBackend('/billing/purchases', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify({ productCode }),
  }, token);
  return response.data;
}

export async function verifyBillingCheckoutPayment(payload) {
  const token = await requireToken();
  const response = await requestBackend('/billing/purchases/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function upsertBillingProfile(payload) {
  const token = await requireToken();
  const response = await requestBackend('/billing/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
  return response.data;
}

export async function cancelBillingSubscription(reason) {
  const token = await requireToken();
  const response = await requestBackend('/billing/subscription/cancel', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }, token);
  return response.data;
}
