import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/jwt.js';

const providerConfigs = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: env.googleRedirectUri,
    scopes: ['openid', 'email', 'profile'],
  },
  linkedin: {
    name: 'LinkedIn',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    clientId: env.linkedinClientId,
    clientSecret: env.linkedinClientSecret,
    redirectUri: env.linkedinRedirectUri,
    scopes: ['openid', 'profile', 'email'],
  },
};

function encodeState(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeState(value = '') {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

function getProviderConfig(provider) {
  const config = providerConfigs[provider];
  if (!config) {
    const error = new Error('Unsupported OAuth provider.');
    error.statusCode = 400;
    throw error;
  }

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    const error = new Error(`${config.name} OAuth is not configured yet.`);
    error.statusCode = 503;
    throw error;
  }

  return config;
}

function buildAuthorizationUrl(provider, options = {}) {
  const config = getProviderConfig(provider);
  const state = encodeState({
    role: options.role || 'CANDIDATE',
    mode: options.mode || 'login',
    provider,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  return `${config.authUrl}?${params.toString()}`;
}

async function exchangeCodeForToken(provider, code) {
  const config = getProviderConfig(provider);
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to exchange ${provider} authorization code. ${text}`);
    error.statusCode = 502;
    throw error;
  }

  return response.json();
}

async function fetchUserProfile(provider, accessToken) {
  const config = getProviderConfig(provider);
  const response = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to fetch ${provider} user profile. ${text}`);
    error.statusCode = 502;
    throw error;
  }

  const profile = await response.json();
  return {
    email: profile.email,
    name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim(),
  };
}

function buildFrontendRedirect(pathname, params = {}) {
  const url = new URL(pathname, env.frontendUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function createPasswordHash() {
  return bcrypt.hash(crypto.randomUUID(), 10);
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function findOrCreateOAuthUser({ email, name, role }) {
  const normalizedEmail = email.toLowerCase().trim();
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { recruiterProfile: true, candidateProfile: true },
  });

  if (user) {
    if (user.role !== role) {
      const error = new Error('This email is already linked to a different account type.');
      error.statusCode = 409;
      throw error;
    }

    return user;
  }

  const passwordHash = await createPasswordHash();

  user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role,
      candidateProfile: role === 'CANDIDATE'
        ? {
            create: {
              fullName: name || normalizedEmail.split('@')[0],
              location: '',
              totalExperience: 0,
              skills: [],
              sharedResumeSlug: slugify(`${name || normalizedEmail}-${Date.now()}`, { lower: true, strict: true }),
            },
          }
        : undefined,
    },
    include: { recruiterProfile: true, candidateProfile: true },
  });

  return user;
}

function resolvePostAuthPath(user) {
  if (user.role === 'RECRUITER') {
    return user.recruiterProfile?.profileCompleted ? '/recruiter' : '/recruiter/onboarding';
  }

  return '/candidate/onboarding';
}

export function getOAuthAuthorizationUrl(provider, options) {
  return buildAuthorizationUrl(provider, options);
}

export async function handleOAuthCallback(provider, code, stateValue) {
  const state = decodeState(stateValue);
  const role = state.role || 'CANDIDATE';
  const mode = state.mode || 'login';
  const tokens = await exchangeCodeForToken(provider, code);
  const profile = await fetchUserProfile(provider, tokens.access_token);

  if (!profile.email) {
    const error = new Error(`${provider} did not return an email address.`);
    error.statusCode = 422;
    throw error;
  }

  const user = await findOrCreateOAuthUser({
    email: profile.email,
    name: profile.name,
    role,
  });

  const token = signToken({ userId: user.id, role: user.role });
  const redirectPath = resolvePostAuthPath(user);

  return {
    redirectUrl: buildFrontendRedirect(redirectPath, {
      token,
      authProvider: provider,
      authMode: mode,
    }),
    user: sanitizeUser(user),
  };
}

export function buildOAuthErrorRedirect(message) {
  return buildFrontendRedirect('/auth', { oauthError: message });
}
