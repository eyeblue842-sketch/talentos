import { prisma } from '../config/db.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';

const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER'];

// The 2-3 predefined, editable assessment templates seeded per organisation the
// first time templates are listed. Mirrors Zoho's Interviewer Feedback Form /
// Technical Screen / Culture Fit scorecards.
const DEFAULT_TEMPLATES = [
  {
    name: 'Interviewer Feedback Form',
    description: 'General-purpose scorecard for any interview round.',
    isDefault: true,
    sections: [
      { title: 'Soft Skills', criteria: [
        { label: 'Communication skills', type: 'RATING', required: true },
        { label: 'Listening skills', type: 'RATING', required: false },
        { label: 'Presentation skills', type: 'RATING', required: false },
        { label: 'Learning capacity', type: 'RATING', required: false },
      ] },
      { title: 'Technical Parameters', criteria: [
        { label: 'Primary skills as per JD', type: 'RATING', required: true },
        { label: 'Secondary skills as per JD', type: 'RATING', required: false },
      ] },
      { title: 'Overall Recommendation', criteria: [
        { label: 'Overall rating', type: 'RATING', required: true },
        { label: 'Overall comments', type: 'TEXT', required: true },
      ] },
    ],
  },
  {
    name: 'Technical Screen',
    description: 'Focused technical evaluation scorecard.',
    isDefault: false,
    sections: [
      { title: 'Technical Depth', criteria: [
        { label: 'Core fundamentals', type: 'RATING', required: true },
        { label: 'Problem solving', type: 'RATING', required: true },
        { label: 'System / design thinking', type: 'RATING', required: false },
        { label: 'Code quality', type: 'RATING', required: false },
      ] },
      { title: 'Outcome', criteria: [
        { label: 'Overall rating', type: 'RATING', required: true },
        { label: 'Notes', type: 'TEXT', required: false },
      ] },
    ],
  },
  {
    name: 'Culture Fit',
    description: 'Behavioural and culture-fit scorecard.',
    isDefault: false,
    sections: [
      { title: 'Behavioural', criteria: [
        { label: 'Collaboration', type: 'RATING', required: true },
        { label: 'Ownership', type: 'RATING', required: true },
        { label: 'Adaptability', type: 'RATING', required: false },
      ] },
      { title: 'Outcome', criteria: [
        { label: 'Overall rating', type: 'RATING', required: true },
        { label: 'Comments', type: 'TEXT', required: true },
      ] },
    ],
  },
];

function serializeTemplate(template) {
  if (!template) return null;
  return {
    id: template.id,
    name: template.name,
    description: template.description || null,
    isDefault: template.isDefault,
    sections: template.sections || [],
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.slice(0, 20).map((section) => ({
    title: String(section?.title || 'Section').slice(0, 120),
    criteria: Array.isArray(section?.criteria)
      ? section.criteria.slice(0, 30).map((c) => ({
        label: String(c?.label || '').slice(0, 160),
        type: c?.type === 'TEXT' ? 'TEXT' : 'RATING',
        required: Boolean(c?.required),
      })).filter((c) => c.label)
      : [],
  })).filter((section) => section.criteria.length);
}

export async function listAssessmentTemplates(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  let templates = await prisma.assessmentTemplate.findMany({
    where: { organisationId: context.organisationId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  if (templates.length === 0) {
    await prisma.assessmentTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({
        organisationId: context.organisationId,
        name: t.name,
        description: t.description,
        isDefault: t.isDefault,
        sections: t.sections,
        createdById: actorUser.id,
      })),
    });
    templates = await prisma.assessmentTemplate.findMany({
      where: { organisationId: context.organisationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }
  return templates.map(serializeTemplate);
}

export async function createAssessmentTemplate(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const name = String(payload.name || '').trim();
  if (name.length < 2) {
    const error = new Error('Give the assessment template a name.');
    error.statusCode = 422;
    throw error;
  }
  const template = await prisma.assessmentTemplate.create({
    data: {
      organisationId: context.organisationId,
      name: name.slice(0, 120),
      description: payload.description ? String(payload.description).slice(0, 500) : null,
      isDefault: Boolean(payload.isDefault),
      sections: normalizeSections(payload.sections),
      createdById: actorUser.id,
    },
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'assessment-template.create',
    entityType: 'AssessmentTemplate',
    entityId: template.id,
    metadata: { name: template.name },
    ...requestMeta,
  });
  return serializeTemplate(template);
}

export async function updateAssessmentTemplate(actorUser, templateId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await prisma.assessmentTemplate.findFirst({ where: { id: templateId, organisationId: context.organisationId } });
  if (!existing) {
    const error = new Error('Assessment template not found.');
    error.statusCode = 404;
    throw error;
  }
  const data = {};
  if (payload.name !== undefined) data.name = String(payload.name).trim().slice(0, 120) || existing.name;
  if (payload.description !== undefined) data.description = payload.description ? String(payload.description).slice(0, 500) : null;
  if (payload.isDefault !== undefined) data.isDefault = Boolean(payload.isDefault);
  if (payload.sections !== undefined) data.sections = normalizeSections(payload.sections);
  const template = await prisma.assessmentTemplate.update({ where: { id: templateId }, data });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'assessment-template.update',
    entityType: 'AssessmentTemplate',
    entityId: template.id,
    ...requestMeta,
  });
  return serializeTemplate(template);
}

export async function deleteAssessmentTemplate(actorUser, templateId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await prisma.assessmentTemplate.findFirst({ where: { id: templateId, organisationId: context.organisationId } });
  if (!existing) {
    const error = new Error('Assessment template not found.');
    error.statusCode = 404;
    throw error;
  }
  await prisma.assessmentTemplate.delete({ where: { id: templateId } });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'assessment-template.delete',
    entityType: 'AssessmentTemplate',
    entityId: templateId,
    ...requestMeta,
  });
  return { id: templateId, deleted: true };
}

// Fetch one template's sections (used when scheduling to seed a round's scorecard).
export async function getAssessmentTemplateSections(organisationId, templateId) {
  if (!templateId) return null;
  const template = await prisma.assessmentTemplate.findFirst({ where: { id: templateId, organisationId } });
  return template ? template.sections : null;
}
