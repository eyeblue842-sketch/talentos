import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken, getTokenExpiryIso } from '../utils/jwt.js';
import { consumeAuthToken, issueAuthToken } from './authTokenService.js';
import { serializeAuthSession, serializeUser } from '../serializers/index.js';
import { touchCandidateLastActive } from './candidateActivityService.js';
import {
  assertEmailAllowedForEmployerType,
  buildRecruiterOrganisationCreateData,
  createRecruiterOrganisation,
  normalizeEmployerType,
} from './employerOnboardingService.js';

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

const supportedRoles = new Set(['CANDIDATE', 'RECRUITER']);
const supportedModes = new Set(['login', 'signup']);

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

function normalizeRole(role = 'CANDIDATE') {
  return supportedRoles.has(role) ? role : 'CANDIDATE';
}

function normalizeMode(mode = 'login') {
  return supportedModes.has(mode) ? mode : 'login';
}

function normalizeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return null;
  }

  return next;
}

async function buildAuthorizationUrl(provider, options = {}) {
  const config = getProviderConfig(provider);
  const role = normalizeRole(options.role);
  const stateContext = {
    provider,
    role,
    // Only meaningful when role === RECRUITER. Defaults to CONSULTANCY (the
    // more permissive policy) rather than silently granting COMPANY status
    // - a caller must explicitly request COMPANY.
    employerType: role === 'RECRUITER' ? (normalizeEmployerType(options.employerType) || 'CONSULTANCY') : null,
    mode: normalizeMode(options.mode),
    next: normalizeNext(options.next),
  };
  const { token: state } = await issueAuthToken(null, 'OAUTH_STATE', {
    context: stateContext,
    invalidateExisting: false,
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
    // Company Recruiter OAuth requires the provider to assert the email is
    // verified (spec: "Google reports the email as verified"). Missing the
    // field entirely is treated as unverified rather than assumed true.
    emailVerified: profile.email_verified === true || profile.email_verified === 'true',
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
  return bcrypt.hash(crypto.randomUUID(), 12);
}

function buildCandidateProfileDefaults({ email, name }) {
  const normalizedEmail = email.toLowerCase().trim();
  const fallbackName = normalizedEmail.split('@')[0];
  const fullName = name?.trim() || fallbackName;

  return {
    fullName,
    email: normalizedEmail,
    location: '',
    preferredLocations: [],
    totalExperience: 0,
    skills: [],
    sharedResumeSlug: slugify(`${fullName}-${Date.now()}`, { lower: true, strict: true }),
  };
}

function buildRecruiterProfileDefaults(email) {
  const normalizedEmail = email.toLowerCase().trim();
  return {
    companyEmailDomain: normalizedEmail.split('@')[1],
    officeLocations: [],
    profileCompleted: false,
  };
}

function logOAuthRepair(event, payload) {
  console.info(JSON.stringify({
    level: 'info',
    event,
    ...payload,
  }));
}

async function findOrCreateOAuthUser({ email, name, role, employerType, emailVerified }) {
  const normalizedEmail = email.toLowerCase().trim();

  // Session rotation / re-authentication for an EXISTING account must never
  // re-derive or change which organisation/type the account belongs to -
  // that would let a stored membership be reclassified just by picking a
  // different employer-access card on a later login. The employerType
  // domain policy therefore only runs below, in the new-user branch.
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

    const updateData = {};
    let repairedCandidateProfile = false;
    let repairedRecruiterProfile = false;

    if (!user.emailVerifiedAt) {
      updateData.emailVerifiedAt = new Date();
    }

    logOAuthRepair('oauth.user.repair.check', {
      userId: user.id,
      role: user.role,
      candidateProfileMissing: role === 'CANDIDATE' ? !user.candidateProfile : false,
      recruiterProfileMissing: role === 'RECRUITER' ? !user.recruiterProfile : false,
      candidateProfileCreatePlanned: false,
      recruiterProfileCreatePlanned: false,
      userUpdatePlanned: Boolean(updateData.emailVerifiedAt),
    });

    if (role === 'CANDIDATE' && !user.candidateProfile) {
      const existingCandidateProfile = await prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      const shouldCreateCandidateProfile = !existingCandidateProfile;

      logOAuthRepair('oauth.user.repair.candidate', {
        userId: user.id,
        role: user.role,
        candidateProfileMissing: true,
        candidateProfileCreatePlanned: shouldCreateCandidateProfile,
        userUpdatePlanned: Boolean(updateData.emailVerifiedAt),
      });

      if (shouldCreateCandidateProfile) {
        await prisma.candidateProfile.create({
          data: {
            userId: user.id,
            ...buildCandidateProfileDefaults({ email: normalizedEmail, name }),
          },
        });
        repairedCandidateProfile = true;
      }
    }

    if (role === 'RECRUITER' && !user.recruiterProfile) {
      const existingRecruiterProfile = await prisma.recruiterProfile.findUnique({
        where: { userId: user.id },
      });
      const shouldCreateRecruiterProfile = !existingRecruiterProfile;

      logOAuthRepair('oauth.user.repair.recruiter', {
        userId: user.id,
        role: user.role,
        recruiterProfileMissing: true,
        recruiterProfileCreatePlanned: shouldCreateRecruiterProfile,
        userUpdatePlanned: Boolean(updateData.emailVerifiedAt),
      });

      if (shouldCreateRecruiterProfile) {
        await prisma.recruiterProfile.create({
          data: {
            userId: user.id,
            ...buildRecruiterProfileDefaults(normalizedEmail),
          },
        });
        repairedRecruiterProfile = true;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      logOAuthRepair('oauth.user.repair.user_update', {
        userId: user.id,
        role: user.role,
        userUpdateExecuted: true,
      });
    }

    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { recruiterProfile: true, candidateProfile: true },
    });

    logOAuthRepair('oauth.user.repair.result', {
      userId: user.id,
      role: user.role,
      repairedCandidateProfile,
      repairedRecruiterProfile,
      candidateProfileId: user.candidateProfile?.id || null,
      recruiterProfileId: user.recruiterProfile?.id || null,
    });

    return { user, isNewUser: false };
  }

  // Google/LinkedIn OAuth is only trusted to create a new RECRUITER account
  // when the provider itself asserts the email is verified - never assumed.
  if (role === 'RECRUITER' && !emailVerified) {
    const error = new Error('Sign-in requires a verified email address from your identity provider.');
    error.statusCode = 422;
    error.code = 'OAUTH_EMAIL_NOT_VERIFIED';
    throw error;
  }

  const classification = role === 'RECRUITER'
    ? await assertEmailAllowedForEmployerType(normalizedEmail, employerType)
    : null;

  const passwordHash = await createPasswordHash();

  user = await prisma.$transaction(async (tx) => {
    const organisation = role === 'RECRUITER'
      ? await createRecruiterOrganisation(tx, await buildRecruiterOrganisationCreateData({ email: normalizedEmail }, classification, tx))
      : null;

    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role,
        emailVerifiedAt: new Date(),
        recruiterProfile: role === 'RECRUITER'
          ? {
              create: {
                organisationId: organisation.id,
                companyEmailDomain: classification.domain,
                officeLocations: [],
                profileCompleted: false,
              },
            }
          : undefined,
        candidateProfile: role === 'CANDIDATE'
          ? {
              create: buildCandidateProfileDefaults({ email: normalizedEmail, name }),
            }
          : undefined,
      },
      include: { recruiterProfile: true, candidateProfile: true },
    });

    if (organisation) {
      await tx.organisationMembership.create({
        data: {
          organisationId: organisation.id,
          userId: createdUser.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
    }

    return createdUser;
  });

  return { user, isNewUser: true };
}

function resolvePostAuthPath(user, nextPath, isNewUser = false) {
  const safeNextPath = normalizeNext(nextPath);
  if (safeNextPath) {
    return safeNextPath;
  }

  if (user.role === 'RECRUITER') {
    return user.recruiterProfile?.profileCompleted ? '/recruiter/home' : '/recruiter/onboarding';
  }

  return isNewUser ? '/candidate/onboarding' : '/candidate/dashboard';
}

export async function getOAuthAuthorizationUrl(provider, options) {
  return buildAuthorizationUrl(provider, options);
}

async function finalizeOAuthCallback(provider, code, stateValue) {
  const stateToken = await consumeAuthToken(stateValue, 'OAUTH_STATE');
  const state = stateToken.context || {};

  if (state.provider !== provider) {
    const error = new Error('Invalid OAuth state.');
    error.statusCode = 400;
    throw error;
  }

  const role = normalizeRole(state.role);

  try {
    const tokens = await exchangeCodeForToken(provider, code);
    const profile = await fetchUserProfile(provider, tokens.access_token);

    if (!profile.email) {
      const error = new Error(`${provider} did not return an email address.`);
      error.statusCode = 422;
      throw error;
    }

    const { user, isNewUser } = await findOrCreateOAuthUser({
      email: profile.email,
      name: profile.name,
      role,
      employerType: state.employerType,
      emailVerified: profile.emailVerified,
    });

    if (user.candidateProfile) {
      await touchCandidateLastActive(user.candidateProfile.id);
    }

    return {
      user,
      state,
      isNewUser,
      nextPath: resolvePostAuthPath(user, state.next, isNewUser),
    };
  } catch (error) {
    // Tag the role (and, for employer flows, the employerType the user
    // originally selected) onto the error so the controller can redirect
    // back to the correct portal/card even though the OAuth state has
    // already been consumed by this point. This is read-only forwarding of
    // a value ALREADY validated at /start time - it does not reopen any
    // state-integrity gap (nothing here is re-trusted as input).
    error.oauthRole = role;
    error.oauthEmployerType = state.employerType || null;
    throw error;
  }
}

export async function handleOAuthCallbackRedirect(provider, code, stateValue) {
  const result = await finalizeOAuthCallback(provider, code, stateValue);
  const { token } = await issueAuthToken(result.user.id, 'OAUTH_HANDOFF');

  return {
    redirectUrl: buildFrontendRedirect('/api/auth/oauth/callback', {
      code: token,
      next: result.nextPath,
    }),
    user: serializeUser(result.user, { includePrivate: true }),
  };
}

export async function exchangeOAuthSessionToken(token) {
  const authToken = await consumeAuthToken(token, 'OAUTH_HANDOFF', { includeUser: true });
  const jwt = signToken({
    userId: authToken.user.id,
    role: authToken.user.role,
    sessionVersion: authToken.user.sessionVersion,
  });

  return {
    token: jwt,
    session: serializeAuthSession(authToken.user, getTokenExpiryIso()),
  };
}

export async function completeOAuthSignIn(provider, code, stateValue) {
  const { user, nextPath } = await finalizeOAuthCallback(provider, code, stateValue);
  const jwt = signToken({
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  return {
    token: jwt,
    session: serializeAuthSession(user, getTokenExpiryIso()),
    nextPath,
  };
}

export function buildOAuthErrorRedirect(message, role, employerType) {
  const destination = normalizeRole(role) === 'RECRUITER' ? '/hire/login' : '/auth/candidate/login';
  const params = { oauthError: message };
  if (destination === '/hire/login') {
    const normalizedEmployerType = normalizeEmployerType(employerType);
    if (normalizedEmployerType) {
      params.employerType = normalizedEmployerType;
    }
  }
  return buildFrontendRedirect(destination, params);
}
