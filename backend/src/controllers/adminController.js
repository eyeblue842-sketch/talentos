import {
  archiveOrRestoreOrganisation,
  archiveOrRestoreOrganisationUnit,
  bulkInviteEnterpriseUsers,
  bulkUpdateEnterpriseUsers,
  createOrUpdateFeatureFlagAdmin,
  createOrUpdateNotificationTemplateAdmin,
  createOrUpdateOrganisationUnit,
  createOrUpdateRoleDefinition,
  getAdminOrganisationProfile,
  getBackgroundJobsDashboard,
  getEnterpriseAdminOverview,
  getEnterpriseAnalytics,
  getLookupAdministration,
  getOrganisationSettingsAdmin,
  getWorkflowAdministration,
  listAdminAuditLogs,
  listEnterpriseUsers,
  listFeatureFlagsAdmin,
  listNotificationTemplatesAdmin,
  listRoleDefinitions,
  transferOrganisationOwnership,
  updateAdminOrganisationProfile,
  updateLookupAdministration,
  updateOrganisationSettingsAdmin,
  updateEnterpriseUserMembership,
  updateWorkflowAdministration,
} from '../services/adminService.js';
import { sendSuccess } from '../utils/response.js';

function meta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export async function getAdminOverview(req, res, next) {
  try {
    const result = await getEnterpriseAdminOverview(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminOrganisation(req, res, next) {
  try {
    const result = await getAdminOrganisationProfile(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchAdminOrganisation(req, res, next) {
  try {
    const result = await updateAdminOrganisationProfile(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminOrganisationArchive(req, res, next) {
  try {
    const result = await archiveOrRestoreOrganisation(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminOrganisationUnit(req, res, next) {
  try {
    const result = await createOrUpdateOrganisationUnit(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, req.body.id ? 200 : 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminOrganisationUnitArchive(req, res, next) {
  try {
    const result = await archiveOrRestoreOrganisationUnit(
      req.user,
      req.params.unitId,
      Boolean(req.body.restore),
      req.user.activeMembership?.organisationId,
      meta(req)
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsers(req, res, next) {
  try {
    const result = await listEnterpriseUsers(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function patchAdminUser(req, res, next) {
  try {
    const result = await updateEnterpriseUserMembership(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminUsersBulkInvite(req, res, next) {
  try {
    const result = await bulkInviteEnterpriseUsers(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminUsersBulkUpdate(req, res, next) {
  try {
    const result = await bulkUpdateEnterpriseUsers(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminOwnershipTransfer(req, res, next) {
  try {
    const result = await transferOrganisationOwnership(req.user, req.body.membershipId, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminRoles(req, res, next) {
  try {
    const result = await listRoleDefinitions(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminRole(req, res, next) {
  try {
    const result = await createOrUpdateRoleDefinition(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, req.body.id ? 200 : 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminSettings(req, res, next) {
  try {
    const result = await getOrganisationSettingsAdmin(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchAdminSettings(req, res, next) {
  try {
    const result = await updateOrganisationSettingsAdmin(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminWorkflow(req, res, next) {
  try {
    const result = await getWorkflowAdministration(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchAdminWorkflow(req, res, next) {
  try {
    const result = await updateWorkflowAdministration(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminAudit(req, res, next) {
  try {
    const result = await listAdminAuditLogs(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getAdminNotificationTemplates(req, res, next) {
  try {
    const result = await listNotificationTemplatesAdmin(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminNotificationTemplate(req, res, next) {
  try {
    const result = await createOrUpdateNotificationTemplateAdmin(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, req.body.id ? 200 : 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminBackgroundJobs(req, res, next) {
  try {
    const result = await getBackgroundJobsDashboard(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminAnalytics(req, res, next) {
  try {
    const result = await getEnterpriseAnalytics(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminFeatureFlags(req, res, next) {
  try {
    const result = await listFeatureFlagsAdmin(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminFeatureFlag(req, res, next) {
  try {
    const result = await createOrUpdateFeatureFlagAdmin(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, req.body.id ? 200 : 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminLookups(req, res, next) {
  try {
    const result = await getLookupAdministration(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchAdminLookups(req, res, next) {
  try {
    const result = await updateLookupAdministration(req.user, req.body, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
