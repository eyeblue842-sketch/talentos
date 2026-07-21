import { Router } from 'express';
import {
  adminAuditQuerySchema,
  adminBulkInviteSchema,
  adminBulkUserUpdateSchema,
  adminFeatureFlagSchema,
  adminLookupUpdateSchema,
  adminMembershipUpdateSchema,
  adminNotificationTemplateSchema,
  adminOrganisationArchiveSchema,
  adminOrganisationProfileUpdateSchema,
  adminOrganisationUnitSchema,
  adminOwnershipTransferSchema,
  adminRoleDefinitionSchema,
  adminSettingsUpdateSchema,
  adminUserListQuerySchema,
  adminWorkflowUpdateSchema,
} from '@careeriz/shared';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  getAdminAnalytics,
  getAdminAudit,
  getAdminBackgroundJobs,
  getAdminFeatureFlags,
  getAdminLookups,
  getAdminNotificationTemplates,
  getAdminOrganisation,
  getAdminOverview,
  getAdminRoles,
  getAdminSettings,
  getAdminUsers,
  getAdminWorkflow,
  patchAdminLookups,
  patchAdminOrganisation,
  patchAdminSettings,
  patchAdminUser,
  patchAdminWorkflow,
  postAdminFeatureFlag,
  postAdminNotificationTemplate,
  postAdminOrganisationArchive,
  postAdminOrganisationUnit,
  postAdminOrganisationUnitArchive,
  postAdminOwnershipTransfer,
  postAdminRole,
  postAdminUsersBulkInvite,
  postAdminUsersBulkUpdate,
} from '../controllers/adminController.js';

export const adminRouter = Router();

adminRouter.use(auth(['RECRUITER', 'ADMIN']));
adminRouter.get('/overview', getAdminOverview);
adminRouter.get('/organisation', getAdminOrganisation);
adminRouter.patch('/organisation', validateSchema(adminOrganisationProfileUpdateSchema), patchAdminOrganisation);
adminRouter.post('/organisation/archive', validateSchema(adminOrganisationArchiveSchema), postAdminOrganisationArchive);
adminRouter.post('/organisation/units', validateSchema(adminOrganisationUnitSchema), postAdminOrganisationUnit);
adminRouter.post('/organisation/units/:unitId/archive', validateSchema(adminOrganisationArchiveSchema), postAdminOrganisationUnitArchive);
adminRouter.get('/users', validateSchema(adminUserListQuerySchema.partial(), 'query'), getAdminUsers);
adminRouter.patch('/users/membership', validateSchema(adminMembershipUpdateSchema), patchAdminUser);
adminRouter.post('/users/bulk-invite', validateSchema(adminBulkInviteSchema), postAdminUsersBulkInvite);
adminRouter.post('/users/bulk-update', validateSchema(adminBulkUserUpdateSchema), postAdminUsersBulkUpdate);
adminRouter.post('/users/transfer-ownership', validateSchema(adminOwnershipTransferSchema), postAdminOwnershipTransfer);
adminRouter.get('/roles', getAdminRoles);
adminRouter.post('/roles', validateSchema(adminRoleDefinitionSchema), postAdminRole);
adminRouter.get('/settings', getAdminSettings);
adminRouter.patch('/settings', validateSchema(adminSettingsUpdateSchema), patchAdminSettings);
adminRouter.get('/workflow', getAdminWorkflow);
adminRouter.patch('/workflow', validateSchema(adminWorkflowUpdateSchema), patchAdminWorkflow);
adminRouter.get('/audit', validateSchema(adminAuditQuerySchema.partial(), 'query'), getAdminAudit);
adminRouter.get('/notification-templates', getAdminNotificationTemplates);
adminRouter.post('/notification-templates', validateSchema(adminNotificationTemplateSchema), postAdminNotificationTemplate);
adminRouter.get('/background-jobs', getAdminBackgroundJobs);
adminRouter.get('/analytics', getAdminAnalytics);
adminRouter.get('/feature-flags', getAdminFeatureFlags);
adminRouter.post('/feature-flags', validateSchema(adminFeatureFlagSchema), postAdminFeatureFlag);
adminRouter.get('/lookups', getAdminLookups);
adminRouter.patch('/lookups', validateSchema(adminLookupUpdateSchema), patchAdminLookups);
