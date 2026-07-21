import { z } from 'zod';
import {
  employmentTypeSchema,
  meetingProviderSchema,
  workplaceTypeSchema,
} from './ats.js';
import {
  notificationTypeSchema,
} from './ats.js';

export const organisationUnitTypeSchema = z.enum([
  'BUSINESS_UNIT',
  'DEPARTMENT',
  'DIVISION',
  'OFFICE_LOCATION',
  'COST_CENTER',
  'LEGAL_ENTITY',
]);

export const userAccountStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
]);

export const enterprisePermissionSchema = z.enum([
  'admin.dashboard.read',
  'organisation.profile.manage',
  'organisation.structure.manage',
  'organisation.settings.manage',
  'organisation.workflow.manage',
  'organisation.audit.read',
  'organisation.analytics.read',
  'organisation.users.read',
  'organisation.users.manage',
  'organisation.users.transfer_ownership',
  'organisation.roles.read',
  'organisation.roles.manage',
  'organisation.notifications.manage',
  'organisation.flags.manage',
  'organisation.lookups.manage',
  'interview.schedule',
  'interview.reschedule',
  'interview.cancel',
  'interview.view',
  'interview.join',
  'interview.manageParticipants',
  'interview.reviewRescheduleRequest',
  'interview.overrideConflict',
  'interview.markNoShow',
  'meetingProvider.manage',
  'meetingProvider.viewStatus',
  'meetingProvider.disconnect',
  'schedulingSettings.manage',
  'schedulingAudit.view',
  'intelligence.resume.read',
  'intelligence.resume.generate',
  'intelligence.match.read',
  'intelligence.match.generate',
  'intelligence.job.generate',
  'intelligence.interview.generate',
  'intelligence.search.use',
  'intelligence.analytics.use',
  'intelligence.governance.read',
  'intelligence.governance.manage',
]);

const stringArray = (maxItems = 100, maxLength = 120) => z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}, z.array(z.string().trim().min(1).max(maxLength)).max(maxItems));

const jsonField = z.record(z.string(), z.any()).optional().default({});

export const adminOrganisationProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(160).optional(),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  publicDescription: z.string().trim().max(4000).optional().nullable().or(z.literal('')),
  industry: z.string().trim().max(160).optional().nullable().or(z.literal('')),
  organisationSize: z.string().trim().max(120).optional().nullable().or(z.literal('')),
  headquarters: z.string().trim().max(160).optional().nullable().or(z.literal('')),
  publicLocations: stringArray(50, 160).optional(),
  cultureSummary: z.string().trim().max(2000).optional().nullable().or(z.literal('')),
  benefitsSummary: z.string().trim().max(2000).optional().nullable().or(z.literal('')),
  careersEnabled: z.boolean().optional(),
}).partial();

export const adminOrganisationArchiveSchema = z.object({
  restore: z.boolean().optional(),
});

export const adminOrganisationUnitSchema = z.object({
  id: z.string().optional(),
  type: organisationUnitTypeSchema,
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(80).optional().nullable().or(z.literal('')),
  description: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  parentId: z.string().optional().nullable(),
  metadata: jsonField,
});

export const adminMembershipUpdateSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER']).optional(),
  customRoleDefinitionId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  accountStatus: userAccountStatusSchema.optional(),
});

export const adminOwnershipTransferSchema = z.object({
  membershipId: z.string().min(1),
});

export const adminBulkInviteSchema = z.object({
  invitations: z.array(z.object({
    email: z.string().email(),
    role: z.enum(['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER']),
  })).min(1).max(50),
});

export const adminBulkUserUpdateSchema = z.object({
  membershipIds: z.array(z.string().min(1)).min(1).max(100),
  role: z.enum(['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER']).optional(),
  customRoleDefinitionId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  accountStatus: userAccountStatusSchema.optional(),
});

export const adminRoleDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  baseRole: z.enum(['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER']).optional().nullable(),
  permissions: z.array(enterprisePermissionSchema).min(1).max(100),
  cloneFromRoleDefinitionId: z.string().optional().nullable(),
});

export const adminSettingsUpdateSchema = z.object({
  timezone: z.string().trim().min(2).max(80).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  language: z.string().trim().min(2).max(40).optional(),
  dateFormat: z.string().trim().min(2).max(40).optional(),
  employmentTypes: z.array(employmentTypeSchema).optional(),
  workModes: z.array(workplaceTypeSchema).optional(),
  interviewSchedulingSettings: z.object({
    defaultMeetingProvider: z.enum(['GOOGLE_MEET', 'ZOOM', 'CUSTOM']).optional(),
    allowedProviders: z.array(z.enum(['GOOGLE_MEET', 'ZOOM', 'CUSTOM'])).max(5).optional(),
    defaultInterviewDuration: z.number().int().min(15).max(480).optional(),
    workingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    workingHours: z.object({
      start: z.string().trim().max(10).optional(),
      end: z.string().trim().max(10).optional(),
    }).optional(),
    minimumSchedulingNoticeMinutes: z.number().int().min(0).max(10080).optional(),
    candidateRescheduleEnabled: z.boolean().optional(),
    interviewerRescheduleEnabled: z.boolean().optional(),
    maximumCandidateRequests: z.number().int().min(0).max(20).optional(),
    maximumRescheduleCount: z.number().int().min(0).max(20).optional(),
    rescheduleCutoffMinutes: z.number().int().min(0).max(10080).optional(),
    reminderIntervalsMinutes: z.array(z.number().int().min(1).max(10080)).max(10).optional(),
    includeRecruiterInInvite: z.boolean().optional(),
    includeCoordinatorInInvite: z.boolean().optional(),
    allowAvailabilityChecks: z.boolean().optional(),
    allowManualCustomLink: z.boolean().optional(),
    zoomWaitingRoomDefault: z.boolean().optional(),
    cancellationReasonRequired: z.boolean().optional(),
  }).optional(),
  experienceBands: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    min: z.number().int().min(0).max(80),
    max: z.number().int().min(0).max(80),
  })).max(20).optional(),
  careerPageSettings: jsonField,
  emailBranding: jsonField,
}).partial();

export const adminWorkflowUpdateSchema = z.object({
  applicationStages: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  interviewPipeline: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  defaultHiringWorkflow: jsonField,
  defaultOfferWorkflow: jsonField,
  interviewTemplates: z.array(z.record(z.string(), z.any())).max(50).optional(),
  offerTemplates: z.array(z.record(z.string(), z.any())).max(50).optional(),
  defaultNotifications: jsonField,
  recruitmentTemplates: z.array(z.record(z.string(), z.any())).max(50).optional(),
}).partial();

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  entityId: z.string().trim().max(120).optional(),
  actorUserId: z.string().trim().max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().trim().max(160).optional(),
});

export const adminNotificationTemplateSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().min(2).max(120),
  category: notificationTypeSchema,
  channel: z.enum(['EMAIL', 'IN_APP']),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(10000),
  enabled: z.boolean().optional(),
});

export const adminFeatureFlagSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().nullable().or(z.literal('')),
  enabled: z.boolean(),
});

export const adminLookupUpdateSchema = z.object({
  skills: stringArray(500, 120).optional(),
  locations: stringArray(500, 160).optional(),
  departments: stringArray(200, 120).optional(),
  employmentTypes: z.array(employmentTypeSchema).optional(),
  currencies: stringArray(100, 10).optional(),
  countries: stringArray(250, 120).optional(),
  interviewTypes: stringArray(100, 80).optional(),
  offerStatuses: stringArray(100, 80).optional(),
  workflowStatuses: stringArray(100, 80).optional(),
}).partial();

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(160).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  accountStatus: userAccountStatusSchema.optional(),
});

export const adminMeetingProviderConfigSchema = z.object({
  provider: meetingProviderSchema,
  calendarId: z.string().trim().max(200).optional().nullable(),
});
