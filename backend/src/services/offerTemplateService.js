import { prisma } from '../config/db.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { storePrivateFile } from '../config/storage.js';

const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER'];

const DEFAULT_LETTER_BODY = `Dear {{candidateName}},

We are delighted to offer you the position of {{designation}} at {{companyName}}.

Below are the details of your offer:

Annual CTC: {{currency}} {{ctcAnnual}}
Fixed component: {{currency}} {{fixedAnnual}}
Variable component: {{currency}} {{variableAnnual}}
Proposed joining date: {{joiningDate}}
Work mode: {{workMode}}
Work location: {{workLocation}}
Reporting to: {{reportingManager}}

This offer is valid until {{expiryDate}}.

Offer reference: {{referenceNumber}}
Date: {{offerDate}}

We are excited about the possibility of you joining our team and look forward to your positive response.

Warm regards,
{{companyName}} Hiring Team`;

const DEFAULT_TEMPLATES = [
  {
    name: 'Offer of Employment',
    description: 'Standard full-time employment offer letter.',
    isDefault: true,
    defaults: { currency: 'INR', offerExpiryDays: 7, workMode: 'ONSITE' },
    letterBody: DEFAULT_LETTER_BODY,
  },
  {
    name: 'Internship Offer',
    description: 'Offer letter for interns / trainees.',
    isDefault: false,
    defaults: { currency: 'INR', offerExpiryDays: 7, workMode: 'ONSITE' },
    letterBody: DEFAULT_LETTER_BODY.replace('position of {{designation}}', 'internship position of {{designation}}'),
  },
];

function serialize(template) {
  if (!template) return null;
  return {
    id: template.id,
    name: template.name,
    description: template.description || null,
    isDefault: template.isDefault,
    defaults: template.defaults || {},
    letterBody: template.letterBody || '',
    hasDocument: Boolean(template.documentStorageKey),
    documentFilename: template.documentFilename || null,
    documentStorageKey: template.documentStorageKey || null,
    documentStorageProvider: template.documentStorageProvider || null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export async function uploadOfferTemplateDocument(actorUser, templateId, file, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await prisma.offerTemplate.findFirst({ where: { id: templateId, organisationId: context.organisationId } });
  if (!existing) {
    const error = new Error('Offer template not found.');
    error.statusCode = 404;
    throw error;
  }
  if (!file || !file.buffer) {
    const error = new Error('Upload a .docx offer letter file.');
    error.statusCode = 422;
    throw error;
  }
  const stored = await storePrivateFile(file, { prefix: 'offer-templates', metadata: { organisationId: context.organisationId, templateId } });
  const template = await prisma.offerTemplate.update({
    where: { id: templateId },
    data: {
      documentStorageKey: stored.storageKey,
      documentStorageProvider: stored.storageProvider,
      documentFilename: file.originalname || 'offer-template.docx',
    },
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer-template.document.upload',
    entityType: 'OfferTemplate',
    entityId: templateId,
    metadata: { filename: template.documentFilename },
    ...requestMeta,
  });
  return serialize(template);
}

export async function listOfferTemplates(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  let templates = await prisma.offerTemplate.findMany({
    where: { organisationId: context.organisationId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  if (templates.length === 0) {
    await prisma.offerTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({
        organisationId: context.organisationId,
        name: t.name,
        description: t.description,
        isDefault: t.isDefault,
        defaults: t.defaults,
        letterBody: t.letterBody,
        createdById: actorUser.id,
      })),
    });
    templates = await prisma.offerTemplate.findMany({
      where: { organisationId: context.organisationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }
  return templates.map(serialize);
}

export async function createOfferTemplate(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const name = String(payload.name || '').trim();
  if (name.length < 2) {
    const error = new Error('Give the offer template a name.');
    error.statusCode = 422;
    throw error;
  }
  const template = await prisma.offerTemplate.create({
    data: {
      organisationId: context.organisationId,
      name: name.slice(0, 120),
      description: payload.description ? String(payload.description).slice(0, 500) : null,
      isDefault: Boolean(payload.isDefault),
      defaults: payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : {},
      letterBody: payload.letterBody ? String(payload.letterBody).slice(0, 20000) : '',
      createdById: actorUser.id,
    },
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer-template.create',
    entityType: 'OfferTemplate',
    entityId: template.id,
    metadata: { name: template.name },
    ...requestMeta,
  });
  return serialize(template);
}

export async function updateOfferTemplate(actorUser, templateId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await prisma.offerTemplate.findFirst({ where: { id: templateId, organisationId: context.organisationId } });
  if (!existing) {
    const error = new Error('Offer template not found.');
    error.statusCode = 404;
    throw error;
  }
  const data = {};
  if (payload.name !== undefined) data.name = String(payload.name).trim().slice(0, 120) || existing.name;
  if (payload.description !== undefined) data.description = payload.description ? String(payload.description).slice(0, 500) : null;
  if (payload.isDefault !== undefined) data.isDefault = Boolean(payload.isDefault);
  if (payload.defaults !== undefined) data.defaults = payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : {};
  if (payload.letterBody !== undefined) data.letterBody = payload.letterBody ? String(payload.letterBody).slice(0, 20000) : '';
  const template = await prisma.offerTemplate.update({ where: { id: templateId }, data });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer-template.update',
    entityType: 'OfferTemplate',
    entityId: template.id,
    ...requestMeta,
  });
  return serialize(template);
}

export async function deleteOfferTemplate(actorUser, templateId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await prisma.offerTemplate.findFirst({ where: { id: templateId, organisationId: context.organisationId } });
  if (!existing) {
    const error = new Error('Offer template not found.');
    error.statusCode = 404;
    throw error;
  }
  await prisma.offerTemplate.delete({ where: { id: templateId } });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer-template.delete',
    entityType: 'OfferTemplate',
    entityId: templateId,
    ...requestMeta,
  });
  return { id: templateId, deleted: true };
}

// Used by the offer PDF generator to render the letter from a chosen template.
export async function getOfferTemplateById(organisationId, templateId) {
  if (!templateId) return null;
  const template = await prisma.offerTemplate.findFirst({ where: { id: templateId, organisationId } });
  return template ? serialize(template) : null;
}
