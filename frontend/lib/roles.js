const ROLE_HOME_ROUTES = {
  CANDIDATE: '/candidate/dashboard',
  RECRUITER: '/recruiter',
  ADMIN: '/admin',
  SUPER_ADMIN: '/admin',
  HIRING_MANAGER: '/recruiter',
  INTERVIEWER: '/recruiter/ats',
};

const WORKSPACE_PATH_PREFIXES = {
  CANDIDATE: ['/candidate', '/jobs', '/companies'],
  RECRUITER: ['/recruiter', '/auth/invitations'],
  ADMIN: ['/admin'],
  SUPER_ADMIN: ['/admin'],
  HIRING_MANAGER: ['/recruiter', '/auth/invitations'],
  INTERVIEWER: ['/recruiter', '/auth/invitations'],
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
