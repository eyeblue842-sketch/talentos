import {
  __searchCandidatesWithAdapters as orchestrateSearchCandidatesWithAdapters,
  addCandidatesToTalentPool as orchestrateAddCandidatesToTalentPool,
  createRecruiterSavedSearch as orchestrateCreateRecruiterSavedSearch,
  createTalentPool as orchestrateCreateTalentPool,
  deleteRecruiterSavedSearch as orchestrateDeleteRecruiterSavedSearch,
  getAuthorizedCandidateDetail as orchestrateGetAuthorizedCandidateDetail,
  getRecruiterCandidatePreview as orchestrateGetRecruiterCandidatePreview,
  indexCandidateResume as orchestrateIndexCandidateResume,
  listRecruiterRecentSearches as orchestrateListRecruiterRecentSearches,
  listRecruiterSavedSearches as orchestrateListRecruiterSavedSearches,
  listTalentPools as orchestrateListTalentPools,
  searchCandidates as orchestrateSearchCandidates,
} from './search/candidateSearchOrchestrator.js';

export function __searchCandidatesWithAdapters(filters = {}, adapters = {}) {
  return orchestrateSearchCandidatesWithAdapters(filters, adapters);
}

export function indexCandidateResume(candidate) {
  return orchestrateIndexCandidateResume(candidate);
}

export function searchCandidates(filters = {}, organisationId, actorUser = null) {
  return orchestrateSearchCandidates(filters, organisationId, actorUser);
}

export function getAuthorizedCandidateDetail(candidateId, organisationId, requestMeta = {}) {
  return orchestrateGetAuthorizedCandidateDetail(candidateId, organisationId, requestMeta);
}

export function getRecruiterCandidatePreview(actorUser, candidateId, organisationId = null, requestMeta = {}) {
  return orchestrateGetRecruiterCandidatePreview(actorUser, candidateId, organisationId, requestMeta);
}

export function listRecruiterSavedSearches(actorUser, organisationId = null) {
  return orchestrateListRecruiterSavedSearches(actorUser, organisationId);
}

export function listRecruiterRecentSearches(actorUser, organisationId = null) {
  return orchestrateListRecruiterRecentSearches(actorUser, organisationId);
}

export function createRecruiterSavedSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  return orchestrateCreateRecruiterSavedSearch(actorUser, payload, organisationId, requestMeta);
}

export function deleteRecruiterSavedSearch(actorUser, searchId, organisationId = null, requestMeta = {}) {
  return orchestrateDeleteRecruiterSavedSearch(actorUser, searchId, organisationId, requestMeta);
}

export function listTalentPools(actorUser, organisationId = null) {
  return orchestrateListTalentPools(actorUser, organisationId);
}

export function createTalentPool(actorUser, payload, organisationId = null, requestMeta = {}) {
  return orchestrateCreateTalentPool(actorUser, payload, organisationId, requestMeta);
}

export function addCandidatesToTalentPool(actorUser, poolId, candidateIds, organisationId = null, requestMeta = {}) {
  return orchestrateAddCandidatesToTalentPool(actorUser, poolId, candidateIds, organisationId, requestMeta);
}
