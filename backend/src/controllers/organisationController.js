import {
  addOrganisationMember,
  createOrganisationPost,
  completeRecruiterWorkspaceOnboarding,
  createOrganisationForUser,
  getCurrentOrganisation,
  getRecruiterWorkspaceOnboarding,
  listOrganisationMembers,
  updateOrganisationMember,
} from '../services/organisationService.js';
import {
  acceptOrganisationInvitation,
  createOrganisationInvitation,
  getInvitationByToken,
  listOrganisationInvitations,
  resendOrganisationInvitation,
  revokeOrganisationInvitation,
} from '../services/organisationInvitationService.js';
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

export async function getOrganisationOnboarding(req, res, next) {
  try {
    const result = await getRecruiterWorkspaceOnboarding(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function completeOrganisationOnboarding(req, res, next) {
  try {
    const result = await completeRecruiterWorkspaceOnboarding(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, result);
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

export async function postOrganisationPost(req, res, next) {
  try {
    const post = await createOrganisationPost(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 201, post);
  } catch (error) {
    next(error);
  }
}

export async function getOrganisationInvitations(req, res, next) {
  try {
    const invitations = await listOrganisationInvitations(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, invitations);
  } catch (error) {
    next(error);
  }
}

export async function postOrganisationInvitation(req, res, next) {
  try {
    const invitation = await createOrganisationInvitation(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 201, invitation);
  } catch (error) {
    next(error);
  }
}

export async function postOrganisationInvitationResend(req, res, next) {
  try {
    const invitation = await resendOrganisationInvitation(
      req.user,
      req.params.invitationId,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, invitation);
  } catch (error) {
    next(error);
  }
}

export async function postOrganisationInvitationRevoke(req, res, next) {
  try {
    const invitation = await revokeOrganisationInvitation(
      req.user,
      req.params.invitationId,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, invitation);
  } catch (error) {
    next(error);
  }
}

export async function getInvitationTokenDetail(req, res, next) {
  try {
    const invitation = await getInvitationByToken(req.params.token);
    sendSuccess(res, 200, invitation);
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitationToken(req, res, next) {
  try {
    const result = await acceptOrganisationInvitation(
      req.user,
      req.body.token,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
