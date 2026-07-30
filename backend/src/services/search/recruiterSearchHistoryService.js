import {
  createRecruiterRecentSearch,
  createRecruiterSavedSearch as createRecruiterSavedSearchRecord,
  deleteRecruiterSavedSearchById,
  findRecruiterRecentSearches,
  findRecruiterSavedSearchById,
  findRecruiterSavedSearches,
} from '../../repositories/search/candidateSearchRepository.js';
import { recordAuditLog } from '../auditLogService.js';
import { requireOrganisationContext } from '../organisationAccessService.js';
import { buildRecentSearchLabel, iso, sanitizeSearchQuery } from './searchUtils.js';

export async function recordRecentSearch(actorUser, organisationId, filters = {}) {
  if (!actorUser?.recruiterProfile?.id || !organisationId) return;
  const query = sanitizeSearchQuery(filters);
  if (!Object.keys(query).length) return;

  await createRecruiterRecentSearch(
    organisationId,
    actorUser.recruiterProfile.id,
    buildRecentSearchLabel(filters),
    query,
  );
}

export async function listRecruiterSavedSearches(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const rows = await findRecruiterSavedSearches(context.organisationId, actorUser.recruiterProfile.id);

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    query: row.query,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function listRecruiterRecentSearches(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const rows = await findRecruiterRecentSearches(context.organisationId, actorUser.recruiterProfile.id);

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    query: row.query,
    createdAt: iso(row.createdAt),
  }));
}

export async function createRecruiterSavedSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const row = await createRecruiterSavedSearchRecord(
    context.organisationId,
    actorUser.recruiterProfile.id,
    payload.label,
    sanitizeSearchQuery(payload.query),
    payload.type || 'SAVED',
  );

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.saved-search.create',
    entityType: 'RecruiterSavedSearch',
    entityId: row.id,
    afterData: { label: row.label, type: row.type },
    ...requestMeta,
  });

  return {
    id: row.id,
    label: row.label,
    type: row.type,
    query: row.query,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function deleteRecruiterSavedSearch(actorUser, searchId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const row = await findRecruiterSavedSearchById(searchId, context.organisationId, actorUser.recruiterProfile.id);

  if (!row) {
    const error = new Error('Saved search not found.');
    error.statusCode = 404;
    throw error;
  }

  await deleteRecruiterSavedSearchById(row.id);
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.saved-search.delete',
    entityType: 'RecruiterSavedSearch',
    entityId: row.id,
    beforeData: { label: row.label, type: row.type },
    ...requestMeta,
  });

  return { deleted: true };
}
