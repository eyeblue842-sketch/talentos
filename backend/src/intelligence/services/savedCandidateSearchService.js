import { savedCandidateSearchResponseSchema } from '@careeriz/shared';
import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { requireEnterprisePermission } from '../../services/enterprisePermissionService.js';
import { searchSemanticCandidates } from './semanticSearchService.js';
import {
  createOrganisationFeature,
  findOrganisationFeature,
} from '../repositories/featureAccessRepository.js';

function serializeSavedSearch(row) {
  return savedCandidateSearchResponseSchema.parse({
    id: row.id,
    organisationId: row.organisationId,
    ownerUserId: row.ownerUserId,
    name: row.name,
    description: row.description || null,
    rawQuery: row.rawQuery || null,
    searchMode: row.searchMode,
    filtersJson: row.filtersJson || {},
    sourceCandidateId: row.sourceCandidateId || null,
    sourceJobId: row.sourceJobId || null,
    jobContextId: row.jobContextId || null,
    isShared: row.isShared,
    isActive: row.isActive,
    lastExecutedAt: row.lastExecutedAt ? row.lastExecutedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function requireSavedSearchFeature(actorUser, permission, flagKey) {
  const context = await requireEnterprisePermission(actorUser, permission);
  const flag = await findOrganisationFeature(context.organisationId, flagKey).catch(() => null);

  if (!flag) {
    await createOrganisationFeature({
        organisationId: context.organisationId,
        key: flagKey,
        description: `Semantic search capability: ${flagKey}`,
        enabled: false,
    }).catch(() => {});
  }

  return {
    ...context,
    featureEnabled: Boolean(flag?.enabled),
  };
}

async function loadSavedSearch(context, savedSearchId, { allowShared = true } = {}) {
  const row = await prisma.savedCandidateSearch.findFirst({
    where: {
      id: savedSearchId,
      organisationId: context.organisationId,
      OR: allowShared
        ? [
            { ownerUserId: context.activeMembership?.userId || null },
            { ownerUserId: context.activeMembership?.userId || context.activeMembership?.user?.id || null },
            { isShared: true },
          ]
        : [
            { ownerUserId: context.activeMembership?.userId || context.activeMembership?.user?.id || null },
          ],
    },
  });

  if (!row) {
    const error = new Error('Saved search not found.');
    error.statusCode = 404;
    throw error;
  }

  return row;
}

export async function listSavedCandidateSearches(actorUser) {
  const context = await requireSavedSearchFeature(actorUser, 'intelligence.saved_search.read', 'intelligence.saved_searches');
  if (!context.featureEnabled) return [];

  const ownerUserId = actorUser.id;
  const rows = await prisma.savedCandidateSearch.findMany({
    where: {
      organisationId: context.organisationId,
      OR: [
        { ownerUserId },
        { isShared: true },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 50,
  });

  return rows.map(serializeSavedSearch);
}

export async function createSavedCandidateSearch(actorUser, payload, requestMeta = {}) {
  const context = await requireSavedSearchFeature(actorUser, 'intelligence.saved_search.manage', 'intelligence.saved_searches');
  if (!context.featureEnabled) {
    const error = new Error('Saved searches are disabled for this organization.');
    error.statusCode = 403;
    throw error;
  }
  if (payload.isShared) {
    await requireEnterprisePermission(actorUser, 'intelligence.saved_search.share', context.organisationId);
  }

  const row = await prisma.savedCandidateSearch.create({
    data: {
      organisationId: context.organisationId,
      ownerUserId: actorUser.id,
      name: payload.name,
      description: payload.description || null,
      rawQuery: payload.rawQuery || null,
      searchMode: payload.searchMode,
      filtersJson: payload.filtersJson || {},
      sourceCandidateId: payload.sourceCandidateId || null,
      sourceJobId: payload.sourceJobId || null,
      jobContextId: payload.jobContextId || null,
      isShared: Boolean(payload.isShared),
      isActive: true,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'semantic-search.saved.create',
    entityType: 'SavedCandidateSearch',
    entityId: row.id,
    afterData: { name: row.name, isShared: row.isShared },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return serializeSavedSearch(row);
}

export async function getSavedCandidateSearch(actorUser, savedSearchId) {
  const context = await requireSavedSearchFeature(actorUser, 'intelligence.saved_search.read', 'intelligence.saved_searches');
  const row = await loadSavedSearch(context, savedSearchId);
  return serializeSavedSearch(row);
}

export async function updateSavedCandidateSearch(actorUser, savedSearchId, payload, requestMeta = {}) {
  const context = await requireSavedSearchFeature(actorUser, 'intelligence.saved_search.manage', 'intelligence.saved_searches');
  const existing = await loadSavedSearch(context, savedSearchId, { allowShared: false });

  if (payload.isShared) {
    await requireEnterprisePermission(actorUser, 'intelligence.saved_search.share', context.organisationId);
  }

  const row = await prisma.savedCandidateSearch.update({
    where: { id: existing.id },
    data: {
      name: payload.name ?? existing.name,
      description: payload.description !== undefined ? (payload.description || null) : existing.description,
      isShared: payload.isShared ?? existing.isShared,
      isActive: payload.isActive ?? existing.isActive,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'semantic-search.saved.update',
    entityType: 'SavedCandidateSearch',
    entityId: row.id,
    beforeData: { name: existing.name, isShared: existing.isShared, isActive: existing.isActive },
    afterData: { name: row.name, isShared: row.isShared, isActive: row.isActive },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return serializeSavedSearch(row);
}

export async function archiveSavedCandidateSearch(actorUser, savedSearchId, requestMeta = {}) {
  const context = await requireSavedSearchFeature(actorUser, 'intelligence.saved_search.manage', 'intelligence.saved_searches');
  const existing = await loadSavedSearch(context, savedSearchId, { allowShared: false });
  const row = await prisma.savedCandidateSearch.update({
    where: { id: existing.id },
    data: {
      isActive: false,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'semantic-search.saved.archive',
    entityType: 'SavedCandidateSearch',
    entityId: row.id,
    beforeData: { isActive: existing.isActive },
    afterData: { isActive: row.isActive },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return serializeSavedSearch(row);
}

export async function executeSavedCandidateSearch(actorUser, savedSearchId, requestMeta = {}) {
  const context = await requireSavedSearchFeature(actorUser, 'intelligence.saved_search.read', 'intelligence.saved_searches');
  const saved = await loadSavedSearch(context, savedSearchId);
  const result = await searchSemanticCandidates(actorUser, {
    query: saved.rawQuery || '',
    mode: saved.searchMode,
    filters: saved.filtersJson || {},
    sourceCandidateId: saved.sourceCandidateId || undefined,
    sourceJobId: saved.sourceJobId || undefined,
    jobId: saved.jobContextId || undefined,
  }, requestMeta);

  await prisma.savedCandidateSearch.update({
    where: { id: saved.id },
    data: { lastExecutedAt: new Date() },
  }).catch(() => {});

  return result;
}
