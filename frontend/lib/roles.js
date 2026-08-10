const ROLE_HOME_ROUTES = {
  CANDIDATE: '/candidate/dashboard',
  RECRUITER: '/recruiter',
  ADMIN: '/admin',
  SUPER_ADMIN: '/admin',
  HIRING_MANAGER: '/recruiter',
  INTERVIEWER: '/recruiter/ats',
  // CANDIDATE_ADMIN is a normal candidate account (no candidate-admin-only
  // surface exists yet - the role is reserved for future use).
  CANDIDATE_ADMIN: '/candidate/dashboard',
  // RECRUITER_ADMIN gets the recruiter/organisation admin panel, scoped to its
  // own organisation via a real membership - same as any recruiter OWNER.
  RECRUITER_ADMIN: '/admin',
  // PLATFORM_ADMIN is the opt-in equivalent of the legacy org-agnostic ADMIN
  // bypass, for optional system-wide access.
  PLATFORM_ADMIN: '/admin',
};

const WORKSPACE_PATH_PREFIXES = {
  CANDIDATE: ['/candidate', '/jobs', '/companies'],
  RECRUITER: ['/recruiter', '/auth/invitations'],
  ADMIN: ['/admin'],
  SUPER_ADMIN: ['/admin'],
  HIRING_MANAGER: ['/recruiter', '/auth/invitations'],
  INTERVIEWER: ['/recruiter', '/auth/invitations'],
  CANDIDATE_ADMIN: ['/candidate', '/jobs', '/companies'],
  RECRUITER_ADMIN: ['/admin', '/recruiter', '/auth/invitations'],
  PLATFORM_ADMIN: ['/admin'],
};

export { ROLE_HOME_ROUTES };

export function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toUpperCase() : null;
}

export function getHomeRouteForRole(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_HOME_ROUTES[normalizedRole] ?? '/auth';
}

export function isSafeInternalPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

export function safeInternalPath(path, fallback = '/auth') {
  return isSafeInternalPath(path) ? path : fallback;
}

export function canAccessPathForRole(role, path) {
  const normalizedRole = normalizeRole(role);
  const normalizedPath = safeInternalPath(path, null);
  if (!normalizedRole || !normalizedPath) {
    return false;
  }

  return (WORKSPACE_PATH_PREFIXES[normalizedRole] || []).some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

export function resolvePostAuthRoute(role, requestedPath) {
  const homeRoute = getHomeRouteForRole(role);
  const normalizedPath = safeInternalPath(requestedPath, homeRoute);

  if (normalizedPath === '/auth' || normalizedPath === '/') {
    return homeRoute;
  }

  return canAccessPathForRole(role, normalizedPath) ? normalizedPath : homeRoute;
}
