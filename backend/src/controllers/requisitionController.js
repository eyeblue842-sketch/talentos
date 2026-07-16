import {
  approveRequisition,
  createRequisition,
  listRequisitions,
  updateRequisition,
} from '../services/requisitionService.js';
import { sendSuccess } from '../utils/response.js';

export async function createOrganisationRequisition(req, res, next) {
  try {
    const requisition = await createRequisition(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, requisition);
  } catch (error) {
    next(error);
  }
}

export async function getOrganisationRequisitions(req, res, next) {
  try {
    const requisitions = await listRequisitions(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, requisitions);
  } catch (error) {
    next(error);
  }
}

export async function editOrganisationRequisition(req, res, next) {
  try {
    const requisition = await updateRequisition(
      req.user,
      req.params.requisitionId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, requisition);
  } catch (error) {
    next(error);
  }
}

export async function approveOrganisationRequisition(req, res, next) {
  try {
    const requisition = await approveRequisition(
      req.user,
      req.params.requisitionId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, requisition);
  } catch (error) {
    next(error);
  }
}
