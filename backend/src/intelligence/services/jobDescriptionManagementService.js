import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { updateJobStatus } from '../../services/jobService.js';

const FEATURE = 'JOB_DESCRIPTION';
const DEFAULT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_PROMPT_KEY = 'JOB_DESCRIPTION_FULL';
const DEFAULT_PROMPT_VERSION = '1.0.0';
const JOB_DESCRIPTION_ENTITY_TYPE = 'JobDescription';

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function scrubText(value = '', maxLength = 4000) {
  return String(value || '')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanArray(value, maxItems = 40, maxLength = 400) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => scrubText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}

function normalizeDraftContent(content = {}) {
  return {
    title: content.title ? scrubText(content.title, 240) : null,
    summary: scrubText(content.summary, 4000),
    responsibilities: cleanArray(content.responsibilities, 40, 400),
    requiredSkills: cleanArray(content.requiredSkills, 40, 120),
    preferredSkills: cleanArray(content.preferredSkills, 40, 120),
    screeningQuestions: cleanArray(content.screeningQuestions, 40, 400),
    assumptions: cleanArray(content.assumptions, 30, 400),
    exclusionaryWordingWarnings: cleanArray(content.exclusionaryWordingWarnings, 20, 400),
    missingFields: cleanArray(content.missingFields, 30, 400),
    interviewFocus: cleanArray(content.interviewFocus, 30, 400),
  };
}

function buildJobSnapshotFromContent(content, currentJob = null, applyTitle = false) {
  const normalized = normalizeDraftContent(content);
  const title = applyTitle && normalized.title
    ? normalized.title
    : scrubText(currentJob?.title || normalized.title || '', 240);
  const requirements = [
    ...normalized.preferredSkills.map((skill) => `Preferred skill: ${skill}`),
    ...normalized.assumptions.map((item) => `Assumption: ${item}`),
    ...normalized.missingFields.map((item) => `Clarify: ${item}`),
  ].slice(0, 60);

  return {
    title: title || scrubText(currentJob?.title || '', 240),
    description: normalized.summary,
    responsibilities: normalized.responsibilities,
    requirements,
    skillsRequired: normalized.requiredSkills.length
      ? normalized.requiredSkills
      : cleanArray(currentJob?.skillsRequired, 40, 120),
  };
}

function serializeDraft(draft) {
  return {
    id: draft.id,
    organisationId: draft.organisationId,
    jobId: draft.jobId,
    versionGroupId: draft.versionGroupId,
    version: draft.version,
    previousVersionId: draft.previousVersionId || null,
    status: draft.status,
    isLatestVersion: Boolean(draft.isLatestVersion),
    title: draft.title || null,
    content: normalizeDraftContent(draft.content || {}),
    jobSnapshot: draft.jobSnapshot || null,
    sourceStateId: draft.sourceStateId || null,
    sourceExecutionId: draft.sourceExecutionId || null,
    sourceResultId: draft.sourceResultId || null,
    templateId: draft.templateId || null,
    templateVersionId: draft.templateVersionId || null,
    approvedAt: iso(draft.approvedAt),
    approvedByUserId: draft.approvedByUserId || null,
    appliedAt: iso(draft.appliedAt),
    appliedByUserId: draft.appliedByUserId || null,
    createdByUserId: draft.createdByUserId || null,
    updatedByUserId: draft.updatedByUserId || null,
    createdAt: iso(draft.createdAt),
    updatedAt: iso(draft.updatedAt),
  };
}

function serializeTemplateVersion(version) {
  return {
    id: version.id,
    templateId: version.templateId,
    version: version.version,
    title: version.title || null,
    content: normalizeDraftContent(version.content || {}),
    schemaVersion: version.schemaVersion,
    promptKey: version.promptKey || null,
    promptVersion: version.promptVersion || null,
    sourceResultId: version.sourceResultId || null,
    createdByUserId: version.createdByUserId || null,
    createdAt: iso(version.createdAt),
  };
}

function serializeTemplate(template) {
  return {
    id: template.id,
    organisationId: template.organisationId || null,
    scope: template.scope,
    key: template.key,
    name: template.name,
    description: template.description || null,
    isActive: Boolean(template.isActive),
    activeVersionId: template.activeVersionId || null,
    activatedAt: iso(template.activatedAt),
    activatedByUserId: template.activatedByUserId || null,
    archivedAt: iso(template.archivedAt),
    createdAt: iso(template.createdAt),
    updatedAt: iso(template.updatedAt),
    versions: Array.isArray(template.versions) ? template.versions.map(serializeTemplateVersion) : undefined,
  };
}

async function getJobAccess(actorUser, jobId, mode = 'read') {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job?.organisationId) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, job.organisationId, mode);
  return { job, permissionContext };
}

async function getDraftAccess(actorUser, draftId, mode = 'read') {
  const draft = await prisma.jobDescriptionDraft.findUnique({
    where: { id: draftId },
    include: { job: true },
  });

  if (!draft?.organisationId) {
    const error = new Error('Job description draft not found.');
    error.statusCode = 404;
    throw error;
  }

  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, draft.organisationId, mode);
  return { draft, permissionContext };
}

async function getTemplateAccess(actorUser, templateId, mode = 'read') {
  const template = await prisma.jobDescriptionTemplate.findUnique({
    where: { id: templateId },
    include: {
      versions: { orderBy: { version: 'desc' } },
      activeVersion: true,
    },
  });

  if (!template) {
    const error = new Error('Job description template not found.');
    error.statusCode = 404;
    throw error;
  }

  const organisationId = template.scope === 'SYSTEM'
    ? null
    : template.organisationId;
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, organisationId, mode);

  if (template.scope !== 'SYSTEM' && template.organisationId !== permissionContext.organisationId) {
    const error = new Error('Job description template not found.');
    error.statusCode = 404;
    throw error;
  }

  return { template, permissionContext };
}

async function getLatestDraftVersion(organisationId, versionGroupId) {
  return prisma.jobDescriptionDraft.findFirst({
    where: {
      organisationId,
      versionGroupId,
      isLatestVersion: true,
    },
    orderBy: { version: 'desc' },
  });
}

function buildTemplateKey(value) {
  return scrubText(value, 120).toLowerCase().replace(/\s+/g, '-');
}

export async function listJobDescriptionDrafts(actorUser, payload) {
  const { job, permissionContext } = await getJobAccess(actorUser, payload.jobId, 'read');
  const drafts = await prisma.jobDescriptionDraft.findMany({
    where: {
      organisationId: permissionContext.organisationId,
      jobId: job.id,
      isLatestVersion: true,
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return drafts.map(serializeDraft);
}

export async function getJobDescriptionDraft(actorUser, payload) {
  const { draft } = await getDraftAccess(actorUser, payload.draftId, 'read');
  return serializeDraft(draft);
}

export async function createJobDescriptionDraft(actorUser, payload, requestMeta = {}) {
  const { job, permissionContext } = await getJobAccess(actorUser, payload.jobId, 'generate');
  const content = normalizeDraftContent(payload.content);
  const jobSnapshot = buildJobSnapshotFromContent(content, job, true);

  const created = await prisma.jobDescriptionDraft.create({
    data: {
      organisationId: permissionContext.organisationId,
      jobId: job.id,
      versionGroupId: randomUUID(),
      version: 1,
      status: payload.approve ? 'APPROVED' : 'DRAFT',
      isLatestVersion: true,
      title: payload.title ? scrubText(payload.title, 240) : content.title,
      content,
      jobSnapshot,
      sourceStateId: payload.sourceStateId || null,
      sourceExecutionId: payload.sourceExecutionId || null,
      sourceResultId: payload.sourceResultId || null,
      templateId: payload.templateId || null,
      templateVersionId: payload.templateVersionId || null,
      approvedAt: payload.approve ? new Date() : null,
      approvedByUserId: payload.approve ? actorUser.id : null,
      createdByUserId: actorUser.id,
      updatedByUserId: actorUser.id,
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.draft.create',
    entityType: 'JobDescriptionDraft',
    entityId: created.id,
    afterData: {
      jobId: created.jobId,
      versionGroupId: created.versionGroupId,
      version: created.version,
      status: created.status,
    },
    ...requestMeta,
  }).catch(() => {});

  return serializeDraft(created);
}

export async function updateJobDescriptionDraft(actorUser, payload, requestMeta = {}) {
  const { draft, permissionContext } = await getDraftAccess(actorUser, payload.draftId, 'generate');
  if (!draft.isLatestVersion) {
    const error = new Error('Only the latest draft version can be updated.');
    error.statusCode = 409;
    throw error;
  }
  if (draft.status === 'APPLIED' || draft.status === 'ARCHIVED') {
    const error = new Error('This draft version cannot be edited.');
    error.statusCode = 409;
    throw error;
  }

  const currentJob = draft.job || await prisma.job.findUnique({ where: { id: draft.jobId } });
  const mergedContent = normalizeDraftContent({
    ...(draft.content || {}),
    ...(payload.content || {}),
  });
  const nextTitle = payload.title !== undefined
    ? (payload.title ? scrubText(payload.title, 240) : null)
    : draft.title;
  const nextStatus = payload.archive
    ? 'ARCHIVED'
    : payload.approve
      ? 'APPROVED'
      : 'DRAFT';

  await prisma.jobDescriptionDraft.update({
    where: { id: draft.id },
    data: {
      isLatestVersion: false,
      updatedByUserId: actorUser.id,
    },
  });

  const created = await prisma.jobDescriptionDraft.create({
    data: {
      organisationId: draft.organisationId,
      jobId: draft.jobId,
      versionGroupId: draft.versionGroupId,
      version: draft.version + 1,
      previousVersionId: draft.id,
      status: nextStatus,
      isLatestVersion: true,
      title: nextTitle,
      content: mergedContent,
      jobSnapshot: buildJobSnapshotFromContent(mergedContent, currentJob, true),
      sourceStateId: draft.sourceStateId,
      sourceExecutionId: draft.sourceExecutionId,
      sourceResultId: draft.sourceResultId,
      templateId: draft.templateId,
      templateVersionId: draft.templateVersionId,
      approvedAt: payload.approve ? new Date() : null,
      approvedByUserId: payload.approve ? actorUser.id : null,
      createdByUserId: draft.createdByUserId || actorUser.id,
      updatedByUserId: actorUser.id,
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.draft.update',
    entityType: 'JobDescriptionDraft',
    entityId: created.id,
    beforeData: {
      previousVersionId: draft.id,
      previousVersion: draft.version,
      previousStatus: draft.status,
    },
    afterData: {
      version: created.version,
      status: created.status,
    },
    ...requestMeta,
  }).catch(() => {});

  return serializeDraft(created);
}

export async function applyJobDescriptionDraft(actorUser, payload, requestMeta = {}) {
  const { draft, permissionContext } = await getDraftAccess(actorUser, payload.draftId, 'generate');
  if (draft.status !== 'APPROVED' && draft.status !== 'APPLIED') {
    const error = new Error('Only approved drafts can be applied.');
    error.statusCode = 409;
    throw error;
  }

  const job = draft.job || await prisma.job.findUnique({ where: { id: draft.jobId } });
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  if (draft.status === 'APPLIED') {
    return {
      draft: serializeDraft(draft),
      jobId: job.id,
      applied: true,
    };
  }

  const snapshot = buildJobSnapshotFromContent(draft.content || {}, job, payload.applyTitle !== false);
  await prisma.job.update({
    where: { id: job.id },
    data: {
      title: snapshot.title,
      description: snapshot.description,
      responsibilities: snapshot.responsibilities,
      requirements: snapshot.requirements,
      skillsRequired: snapshot.skillsRequired,
    },
  });

  // Status changes - especially DRAFT/ON_HOLD/CLOSED -> OPEN - MUST go
  // through jobService.updateJobStatus, never a direct prisma.job.update,
  // so a job-posting credit is actually checked/consumed. A raw status
  // write here would have been a live bypass of the entitlement system
  // (B1 hardening, section 4: "no alternate endpoint may activate a job
  // without consuming a valid credit").
  if (payload.publishStatus && payload.publishStatus !== job.status) {
    await updateJobStatus(job.id, actorUser, payload.publishStatus, permissionContext.organisationId, requestMeta);
  }

  const applied = await prisma.jobDescriptionDraft.update({
    where: { id: draft.id },
    data: {
      status: 'APPLIED',
      appliedAt: new Date(),
      appliedByUserId: actorUser.id,
      appliedJobSnapshot: snapshot,
      updatedByUserId: actorUser.id,
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.draft.apply',
    entityType: 'JobDescriptionDraft',
    entityId: applied.id,
    metadata: {
      jobId: job.id,
      publishStatus: payload.publishStatus || null,
    },
    afterData: snapshot,
    ...requestMeta,
  }).catch(() => {});

  return {
    draft: serializeDraft(applied),
    jobId: job.id,
    applied: true,
  };
}

export async function listJobDescriptionTemplates(actorUser) {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, 'read');
  const templates = await prisma.jobDescriptionTemplate.findMany({
    where: {
      OR: [
        { scope: 'SYSTEM' },
        { organisationId: permissionContext.organisationId },
      ],
    },
    include: {
      activeVersion: true,
    },
    orderBy: [
      { scope: 'asc' },
      { updatedAt: 'desc' },
    ],
  });

  return templates.map((template) => serializeTemplate({
    ...template,
    versions: template.activeVersion ? [template.activeVersion] : undefined,
  }));
}

export async function createJobDescriptionTemplate(actorUser, payload, requestMeta = {}) {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, 'generate');
  const content = normalizeDraftContent(payload.content);
  const key = buildTemplateKey(payload.key);

  const template = await prisma.jobDescriptionTemplate.create({
    data: {
      organisationId: permissionContext.organisationId,
      scope: 'ORGANISATION',
      key,
      name: scrubText(payload.name, 240),
      description: payload.description ? scrubText(payload.description, 1000) : null,
      isActive: payload.isActive !== false,
      createdByUserId: actorUser.id,
      updatedByUserId: actorUser.id,
      activatedByUserId: payload.isActive === false ? null : actorUser.id,
      activatedAt: payload.isActive === false ? null : new Date(),
    },
  });

  const version = await prisma.jobDescriptionTemplateVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      title: payload.title ? scrubText(payload.title, 240) : content.title,
      content,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      promptKey: DEFAULT_PROMPT_KEY,
      promptVersion: DEFAULT_PROMPT_VERSION,
      createdByUserId: actorUser.id,
    },
  });

  const updatedTemplate = await prisma.jobDescriptionTemplate.update({
    where: { id: template.id },
    data: {
      activeVersionId: version.id,
    },
    include: {
      versions: { orderBy: { version: 'desc' } },
      activeVersion: true,
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.template.create',
    entityType: 'JobDescriptionTemplate',
    entityId: template.id,
    afterData: {
      key: template.key,
      activeVersionId: version.id,
    },
    ...requestMeta,
  }).catch(() => {});

  return serializeTemplate(updatedTemplate);
}

export async function getJobDescriptionTemplate(actorUser, payload) {
  const { template } = await getTemplateAccess(actorUser, payload.templateId, 'read');
  return serializeTemplate(template);
}

export async function createJobDescriptionTemplateVersion(actorUser, payload, requestMeta = {}) {
  const { template, permissionContext } = await getTemplateAccess(actorUser, payload.templateId, 'generate');
  if (template.scope === 'SYSTEM' && actorUser.role !== 'ADMIN') {
    const error = new Error('Insufficient organisation permissions.');
    error.statusCode = 403;
    throw error;
  }

  const nextVersion = (template.versions?.[0]?.version || 0) + 1;
  const content = normalizeDraftContent(payload.content);

  const version = await prisma.jobDescriptionTemplateVersion.create({
    data: {
      templateId: template.id,
      version: nextVersion,
      title: payload.title ? scrubText(payload.title, 240) : content.title,
      content,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      promptKey: payload.promptKey ? scrubText(payload.promptKey, 120) : DEFAULT_PROMPT_KEY,
      promptVersion: payload.promptVersion ? scrubText(payload.promptVersion, 40) : DEFAULT_PROMPT_VERSION,
      sourceResultId: payload.sourceResultId || null,
      createdByUserId: actorUser.id,
    },
  });

  if (payload.activate) {
    await prisma.jobDescriptionTemplate.update({
      where: { id: template.id },
      data: {
        activeVersionId: version.id,
        isActive: true,
        activatedAt: new Date(),
        activatedByUserId: actorUser.id,
        updatedByUserId: actorUser.id,
        archivedAt: null,
      },
    });
  }

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.template.version.create',
    entityType: 'JobDescriptionTemplateVersion',
    entityId: version.id,
    metadata: {
      templateId: template.id,
      version: version.version,
      activated: Boolean(payload.activate),
    },
    ...requestMeta,
  }).catch(() => {});

  return serializeTemplateVersion(version);
}

export async function activateJobDescriptionTemplate(actorUser, payload, requestMeta = {}) {
  const { template, permissionContext } = await getTemplateAccess(actorUser, payload.templateId, 'generate');
  if (template.scope === 'SYSTEM' && actorUser.role !== 'ADMIN') {
    const error = new Error('Insufficient organisation permissions.');
    error.statusCode = 403;
    throw error;
  }

  const nextActive = payload.versionId
    ? template.versions?.find((item) => item.id === payload.versionId) || null
    : template.activeVersion || template.versions?.[0] || null;

  const isActive = payload.active !== false;
  const updated = await prisma.jobDescriptionTemplate.update({
    where: { id: template.id },
    data: {
      isActive,
      activeVersionId: nextActive?.id || template.activeVersionId || null,
      activatedAt: isActive ? new Date() : template.activatedAt,
      activatedByUserId: isActive ? actorUser.id : template.activatedByUserId,
      updatedByUserId: actorUser.id,
      archivedAt: isActive ? null : new Date(),
    },
    include: {
      versions: { orderBy: { version: 'desc' } },
      activeVersion: true,
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: isActive
      ? 'intelligence.job.template.activate'
      : 'intelligence.job.template.archive',
    entityType: 'JobDescriptionTemplate',
    entityId: template.id,
    metadata: {
      versionId: nextActive?.id || null,
    },
    ...requestMeta,
  }).catch(() => {});

  return serializeTemplate(updated);
}

export async function getJobDescriptionHistory(actorUser, payload) {
  const { job, permissionContext } = await getJobAccess(actorUser, payload.jobId, 'read');
  const [state, drafts, generations] = await Promise.all([
    prisma.jobDescriptionState.findUnique({
      where: {
        organisationId_jobId_kind: {
          organisationId: permissionContext.organisationId,
          jobId: job.id,
          kind: 'FULL_DESCRIPTION',
        },
      },
    }),
    prisma.jobDescriptionDraft.findMany({
      where: {
        organisationId: permissionContext.organisationId,
        jobId: job.id,
      },
      orderBy: [
        { versionGroupId: 'asc' },
        { version: 'desc' },
      ],
    }),
    prisma.intelligenceResult.findMany({
      where: {
        organisationId: permissionContext.organisationId,
        entityType: JOB_DESCRIPTION_ENTITY_TYPE,
        entityId: job.id,
        resultVersion: 'job-description-v2',
      },
      include: {
        execution: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    jobId: job.id,
    state: state ? {
      jobId: job.id,
      kind: state.kind,
      status: state.status,
      stale: state.status === 'STALE',
      generatedAt: iso(state.generatedAt),
      latestExecutionId: state.latestExecutionId || null,
      latestResultId: state.latestResultId || null,
      sourceVersion: state.sourceVersion,
      promptVersion: state.promptVersion,
      resultVersion: state.resultVersion,
    } : null,
    drafts: drafts.map(serializeDraft),
    generations: generations.map((result) => ({
      resultId: result.id,
      executionId: result.executionId,
      status: result.execution?.status || 'UNKNOWN',
      generatedAt: iso(result.createdAt),
      promptVersion: result.promptVersion,
      resultVersion: result.resultVersion,
      sourceFingerprint: result.sourceFingerprint,
    })),
  };
}
