import {
  completeInitialSetup,
  getInitialSetupStatus,
  resetInitialSetup,
} from '../services/setupService.js';
import { sendSuccess } from '../utils/response.js';

function meta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export async function getSetupStatus(req, res, next) {
  try {
    const result = await getInitialSetupStatus();
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postInitialSetup(req, res, next) {
  try {
    const result = await completeInitialSetup(req.body, meta(req));
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postResetInitialSetup(req, res, next) {
  try {
    const result = await resetInitialSetup(req.user, req.body.password, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
