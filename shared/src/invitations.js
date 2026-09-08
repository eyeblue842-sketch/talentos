// Canonical organisation-invitation link contract, shared by the email
// generator (backend/src/services/organisationInvitationService.js) and
// every frontend consumer (accept page, redirect-preservation "next"
// values) so the route and query-param name can never drift apart between
// producer and consumer.
export const INVITATION_ACCEPT_PATH = '/auth/invitations/accept';
export const INVITATION_TOKEN_PARAM = 'token';

export function buildInvitationAcceptUrl(baseUrl, rawToken) {
  const url = new URL(INVITATION_ACCEPT_PATH, baseUrl);
  url.searchParams.set(INVITATION_TOKEN_PARAM, rawToken);
  return url;
}

export function buildInvitationAcceptPath(rawToken) {
  const params = new URLSearchParams();
  params.set(INVITATION_TOKEN_PARAM, rawToken);
  return `${INVITATION_ACCEPT_PATH}?${params.toString()}`;
}
