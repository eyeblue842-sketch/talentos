import {
  addOrganisationMember,
  createOrganisationForUser,
  getCurrentOrganisation,
  listOrganisationMembers,
  updateOrganisationMember,
} from '../services/organisationService.js';
import { listAuditLogsForOrganisation } from '../services/auditLogService.js';
import { sendSuccess } from '../utils/response.js';

export async function createOrganisation(req, res, next) {
  try {
    const organisation = await createOrganisationForUser(req.user, req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, organisation);
  } catch (error) {
    next(error);
  }
}

export async function getOrganisation(req, res, next) {
  try {
    const organisation = await getCurrentOrganisation(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, organisation);
  } catch (error) {
    next(error);
  }
}

export async function getOrganisationMembers(req, res, next) {
  try {
    const members = await listOrganisationMembers(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, members);
  } catch (error) {
    next(error);
  }
}

export async function createOrganisationMember(req, res, next) {
  try {
    const member = await addOrganisationMember(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, member);
  } catch (error) {
    next(error);
  }
}

export async function editOrganisationMember(req, res, next) {
  try {
    const member = await updateOrganisationMember(
      req.user,
      req.params.membershipId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, member);
  } catch (error) {
    next(error);
  }
}

export async function getOrganisationAuditLogs(req, res, next) {
  try {
    const logs = await listAuditLogsForOrganisation(req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, logs);
  } catch (error) {
    next(error);
  }
}
