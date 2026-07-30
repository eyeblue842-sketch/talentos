import {
  createTalentPoolRecord,
  findCandidateIdsAndNames,
  findTalentPoolById,
  findTalentPoolsByOrganisation,
  upsertTalentPoolCandidate,
} from '../../repositories/search/candidateSearchRepository.js';
import { recordAuditLog } from '../auditLogService.js';
import { requireOrganisationContext } from '../organisationAccessService.js';
import { iso } from '../search/searchUtils.js';

export async function listTalentPools(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const rows = await findTalentPoolsByOrganisation(context.organisationId);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    candidateCount: row.candidates.length,
    candidates: row.candidates.map((item) => ({
      id: item.candidate.id,
      fullName: item.candidate.fullName,
    })),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function createTalentPool(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const pool = await createTalentPoolRecord(
    context.organisationId,
    actorUser.recruiterProfile.id,
    payload.name,
    payload.description,
  );

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.talent-pool.create',
    entityType: 'TalentPool',
    entityId: pool.id,
    afterData: { name: pool.name },
    ...requestMeta,
  });

  return {
    id: pool.id,
    name: pool.name,
    description: pool.description,
    createdAt: iso(pool.createdAt),
    updatedAt: iso(pool.updatedAt),
  };
}

export async function addCandidatesToTalentPool(actorUser, poolId, candidateIds, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const pool = await findTalentPoolById(poolId, context.organisationId);

  if (!pool) {
    const error = new Error('Talent pool not found.');
    error.statusCode = 404;
    throw error;
  }

  const candidates = await findCandidateIdsAndNames(candidateIds);

  const validIds = new Set(candidates.map((candidate) => candidate.id));
  const items = [];
  for (const candidateId of candidateIds) {
    if (!validIds.has(candidateId)) {
      items.push({ candidateId, success: false, error: 'Candidate not found.' });
      continue;
    }

    try {
      const membership = await upsertTalentPoolCandidate(pool.id, candidateId);
      items.push({ candidateId, success: true, id: membership.id });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.talent-pool.candidates.add',
    entityType: 'TalentPool',
    entityId: pool.id,
    metadata: {
      addedCount: items.filter((item) => item.success).length,
      candidateIds,
    },
    ...requestMeta,
  });

  return {
    pool: {
      id: pool.id,
      name: pool.name,
    },
    items,
  };
}
