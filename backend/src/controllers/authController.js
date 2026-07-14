import { registerUser, loginUser, updateRecruiterProfile } from '../services/authService.js';
import {
  buildOAuthErrorRedirect,
  getOAuthAuthorizationUrl,
  handleOAuthCallback,
} from '../services/oauthService.js';

export async function signup(req, res, next) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({ success: true, data: req.user });
}

export async function saveRecruiterProfile(req, res, next) {
  try {
    const result = await updateRecruiterProfile(req.user.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function startOAuth(req, res, next) {
  try {
    const url = getOAuthAuthorizationUrl(req.params.provider, {
      role: req.query.role,
      mode: req.query.mode,
    });
    res.redirect(url);
  } catch (error) {
    res.redirect(buildOAuthErrorRedirect(error.message));
  }
}

export async function oauthCallback(req, res, next) {
  try {
    const result = await handleOAuthCallback(req.params.provider, req.query.code, req.query.state);
    res.redirect(result.redirectUrl);
  } catch (error) {
    res.redirect(buildOAuthErrorRedirect(error.message));
  }
}
