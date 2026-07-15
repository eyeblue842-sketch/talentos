import {
  createPasswordResetSession,
  confirmEmailVerification,
  confirmPasswordReset,
  loginUser,
  logoutUser,
  registerUser,
  requestEmailVerification,
  requestPasswordReset,
  updateRecruiterProfile,
} from '../services/authService.js';
import {
  buildOAuthErrorRedirect,
  exchangeOAuthSessionToken,
  getOAuthAuthorizationUrl,
  handleOAuthCallback,
} from '../services/oauthService.js';
import { serializeUser } from '../serializers/index.js';
import { sendSuccess } from '../utils/response.js';

export async function signup(req, res, next) {
  try {
    const result = await registerUser(req.body);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  sendSuccess(res, 200, serializeUser(req.user, { includePrivate: true }));
}

export async function passwordResetRequest(req, res, next) {
  try {
    const result = await requestPasswordReset(req.body.email);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function passwordResetSession(req, res, next) {
  try {
    const result = await createPasswordResetSession(req.body.token);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function passwordResetConfirm(req, res, next) {
  try {
    const result = await confirmPasswordReset(req.body.token, req.body.password);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function emailVerificationRequest(req, res, next) {
  try {
    const result = await requestEmailVerification(req.body.email);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function emailVerificationConfirm(req, res, next) {
  try {
    const result = await confirmEmailVerification(req.body.token);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function saveRecruiterProfile(req, res, next) {
  try {
    const result = await updateRecruiterProfile(req.user.id, req.body);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const result = await logoutUser(req.user.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function startOAuth(req, res) {
  try {
    const url = await getOAuthAuthorizationUrl(req.params.provider, {
      role: req.query.role,
      mode: req.query.mode,
    });
    res.redirect(url);
  } catch (error) {
    res.redirect(buildOAuthErrorRedirect(error.message));
  }
}

export async function oauthCallback(req, res) {
  try {
    const result = await handleOAuthCallback(req.params.provider, req.query.code, req.query.state);
    res.redirect(result.redirectUrl);
  } catch (error) {
    res.redirect(buildOAuthErrorRedirect(error.message));
  }
}

export async function oauthExchange(req, res, next) {
  try {
    const result = await exchangeOAuthSessionToken(req.body.token);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
