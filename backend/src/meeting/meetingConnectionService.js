import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { consumeAuthToken, issueAuthToken } from '../services/authTokenService.js';
import { requireEnterprisePermission } from '../services/enterprisePermissionService.js';
import { buildOrganisationAccessError } from '../services/organisationAccessService.js';
import { recordAuditLog } from '../services/auditLogService.js';
import { decryptMeetingSecret, encryptMeetingSecret } from './meetingEncryptionService.js';
import { providerStateTtlMinutes } from './meetingConstants.js';
import { getMeetingProvider } from './providers/meetingProviderFactory.js';

function getProviderOAuthConfig(provider) {
  if (provider === 'GOOGLE_MEET') {
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      redirectUri: env.googleMeetingRedirectUri,
      scopes: [
        'openid',
        'email',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
    };
  }

  if (provider === 'ZOOM') {
    return {
      authUrl: 'https://zoom.us/oauth/authorize',
      tokenUrl: 'https://zoom.us/oauth/token',
      clientId: env.zoomClientId,
      clientSecret: env.zoomClientSecret,
      redirectUri: env.zoomRedirectUri,
      scopes: [],
    };
  }

  return null;
}

function buildFrontendAdminRedirect(params = {}) {
  const url = new URL('/admin/settings', env.publicAppUrl);
  url.searchParams.set('tab', 'meeting-providers');
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function serializeConnection(connection) {
  if (!connection) return null;
  return {
    id: connection.id,
    organisationId: connection.organisationId,
    provider: connection.provider,
    status: connection.status,
    connectedAccountId: connection.connectedAccountId,
    connectedEmail: connection.connectedEmail,
    scopes: connection.scopes || [],
    calendarId: connection.calendarId,
    providerMetadata: connection.providerMetadata || {},
    lastValidatedAt: connection.lastValidatedAt?.toISOString?.() || connection.lastValidatedAt || null,
    lastErrorCode: connection.lastErrorCode,
    accessTokenExpiresAt: connection.accessTokenExpiresAt?.toISOString?.() || connection.accessTokenExpiresAt || null,
    createdAt: connection.createdAt?.toISOString?.() || connection.createdAt || null,
    updatedAt: connection.updatedAt?.toISOString?.() || connection.updatedAt || null,
  };
}

async function upsertConnection(organisationId, provider, data, actorUserId) {
  const existing = await prisma.meetingProviderConnection.findUnique({
    where: { organisationId_provider: { organisationId, provider } },
  });

  if (existing) {
    return prisma.meetingProviderConnection.update({
      where: { id: existing.id },
      data: {
        ...data,
        connectedByUserId: actorUserId || existing.connectedByUserId,
      },
    });
  }

  return prisma.meetingProviderConnection.create({
    data: {
      organisationId,
      provider,
      connectedByUserId: actorUserId || null,
      ...data,
    },
  });
}

async function exchangeProviderCode(provider, code) {
  const config = getProviderOAuthConfig(provider);
  if (!config?.clientId || !config?.clientSecret || !config?.redirectUri) {
    const error = new Error(`${provider} is not configured.`);
    error.statusCode = 503;
    throw error;
  }

  if (provider === 'GOOGLE_MEET') {
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
      const error = new Error('Google provider connection failed.');
      error.statusCode = 502;
      throw error;
    }
    return response.json();
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!response.ok) {
    const error = new Error('Zoom provider connection failed.');
    error.statusCode = 502;
    throw error;
  }
  return response.json();
}

export async function listMeetingProviderConnections(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'meetingProvider.viewStatus', organisationId);
  const rows = await prisma.meetingProviderConnection.findMany({
    where: { organisationId: context.organisationId },
    orderBy: { provider: 'asc' },
  });
  return rows.map(serializeConnection);
}

export async function beginMeetingProviderOAuth(actorUser, provider, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'meetingProvider.manage', organisationId);
  const config = getProviderOAuthConfig(provider);
  if (!config) {
    const error = new Error('This provider does not use OAuth.');
    error.statusCode = 422;
    throw error;
  }

  const { token: stateToken } = await issueAuthToken(actorUser.id, 'MEETING_PROVIDER_STATE', {
    expiresAt: new Date(Date.now() + (providerStateTtlMinutes * 60 * 1000)),
    context: {
      provider,
      organisationId: context.organisationId,
      userId: actorUser.id,
    },
    invalidateExisting: false,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state: stateToken,
  });

  if (provider === 'GOOGLE_MEET') {
    params.set('scope', config.scopes.join(' '));
    params.set('access_type', 'offline');
    params.set('include_granted_scopes', 'true');
    params.set('prompt', 'consent');
  }

  return {
    authorizationUrl: `${config.authUrl}?${params.toString()}`,
  };
}

export async function handleMeetingProviderOAuthCallback(provider, code, stateValue) {
  const stateToken = await consumeAuthToken(stateValue, 'MEETING_PROVIDER_STATE', { includeUser: true });
  const state = stateToken.context || {};

  if (state.provider !== provider) {
    throw buildOrganisationAccessError('Invalid meeting provider state.', 400);
  }

  const membership = await prisma.organisationMembership.findFirst({
    where: {
      organisationId: state.organisationId,
      userId: state.userId,
      status: 'ACTIVE',
    },
    include: { customRoleDefinition: true, organisation: true },
  });

  if (!membership) {
    throw buildOrganisationAccessError('Organisation membership required.', 403);
  }

  const tokenPayload = await exchangeProviderCode(provider, code);
  const providerInstance = getMeetingProvider(provider);
  const validated = await providerInstance.validateConnection({
    accessToken: tokenPayload.access_token,
  });

  const accessTokenExpiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + (Number(tokenPayload.expires_in) * 1000))
    : null;

  const connection = await upsertConnection(state.organisationId, provider, {
    status: validated.status || 'CONNECTED',
    connectedAccountId: validated.connectedAccountId || null,
    connectedEmail: validated.connectedEmail || null,
    encryptedRefreshToken: tokenPayload.refresh_token ? encryptMeetingSecret(tokenPayload.refresh_token) : undefined,
    encryptedAccessToken: tokenPayload.access_token ? encryptMeetingSecret(tokenPayload.access_token) : undefined,
    accessTokenExpiresAt,
    scopes: validated.scopes || [],
    lastValidatedAt: new Date(),
    lastErrorCode: null,
  }, state.userId);

  await recordAuditLog({
    organisationId: state.organisationId,
    actorUserId: state.userId,
    action: 'meeting-provider.connect',
    entityType: 'MeetingProviderConnection',
    entityId: connection.id,
    metadata: {
      provider,
      connectedEmail: connection.connectedEmail,
    },
  });

  return buildFrontendAdminRedirect({
    provider,
    meetingProviderStatus: 'connected',
  });
}

export async function getUsableMeetingConnection(organisationId, provider) {
  if (provider === 'CUSTOM') {
    return null;
  }

  const connection = await prisma.meetingProviderConnection.findUnique({
    where: { organisationId_provider: { organisationId, provider } },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    const error = new Error(`${provider} is not connected for this organisation.`);
    error.statusCode = 422;
    throw error;
  }

  return connection;
}

export async function resolveMeetingProviderAccessToken(connection) {
  if (!connection) return null;
  const provider = getMeetingProvider(connection.provider, connection);
  const currentAccessToken = connection.encryptedAccessToken ? decryptMeetingSecret(connection.encryptedAccessToken) : null;

  if (currentAccessToken && (!connection.accessTokenExpiresAt || new Date(connection.accessTokenExpiresAt).getTime() > (Date.now() + 60 * 1000))) {
    return { accessToken: currentAccessToken, connection };
  }

  if (!connection.encryptedRefreshToken) {
    const error = new Error('Provider connection requires reconnection.');
    error.statusCode = 422;
    throw error;
  }

  const refreshToken = decryptMeetingSecret(connection.encryptedRefreshToken);
  const tokenPayload = await provider.refreshAccessToken({ refreshToken });
  const updated = await prisma.meetingProviderConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: tokenPayload.access_token ? encryptMeetingSecret(tokenPayload.access_token) : connection.encryptedAccessToken,
      encryptedRefreshToken: tokenPayload.refresh_token ? encryptMeetingSecret(tokenPayload.refresh_token) : connection.encryptedRefreshToken,
      accessTokenExpiresAt: tokenPayload.expires_in ? new Date(Date.now() + (Number(tokenPayload.expires_in) * 1000)) : connection.accessTokenExpiresAt,
      status: 'CONNECTED',
      lastValidatedAt: new Date(),
      lastErrorCode: null,
    },
  });

  return {
    accessToken: tokenPayload.access_token || currentAccessToken,
    connection: updated,
  };
}

export async function validateMeetingProviderConnection(actorUser, provider, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'meetingProvider.manage', organisationId);
  const connection = await getUsableMeetingConnection(context.organisationId, provider);
  const { accessToken } = await resolveMeetingProviderAccessToken(connection);
  const providerInstance = getMeetingProvider(provider, connection);

  const validated = await providerInstance.validateConnection({ accessToken });
  const updated = await prisma.meetingProviderConnection.update({
    where: { id: connection.id },
    data: {
      status: 'CONNECTED',
      connectedAccountId: validated.connectedAccountId || connection.connectedAccountId,
      connectedEmail: validated.connectedEmail || connection.connectedEmail,
      scopes: validated.scopes || connection.scopes,
      lastValidatedAt: new Date(),
      lastErrorCode: null,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'meeting-provider.validate',
    entityType: 'MeetingProviderConnection',
    entityId: updated.id,
    metadata: { provider },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeConnection(updated);
}

export async function disconnectMeetingProvider(actorUser, provider, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'meetingProvider.disconnect', organisationId);
  const connection = await prisma.meetingProviderConnection.findUnique({
    where: { organisationId_provider: { organisationId: context.organisationId, provider } },
  });

  if (!connection) {
    return { disconnected: true };
  }

  await prisma.meetingProviderConnection.update({
    where: { id: connection.id },
    data: {
      status: 'DISCONNECTED',
      encryptedRefreshToken: null,
      encryptedAccessToken: null,
      accessTokenExpiresAt: null,
      lastErrorCode: null,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'meeting-provider.disconnect',
    entityType: 'MeetingProviderConnection',
    entityId: connection.id,
    metadata: { provider },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return { disconnected: true };
}
