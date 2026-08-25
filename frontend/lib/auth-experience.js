export const candidateAuthRoutes = {
  login: '/auth/candidate/login',
  register: '/auth/candidate/register',
  forgotPassword: '/auth/candidate/forgot-password',
};

export const employerAuthRoutes = {
  landing: '/hire',
  login: '/hire/login',
  register: '/hire/register',
  forgotPassword: '/hire/forgot-password',
};

export const VALID_EMPLOYER_TYPES = ['CONSULTANCY', 'COMPANY'];

export function normalizeEmployerType(value) {
  const upper = String(value || '').toUpperCase();
  return VALID_EMPLOYER_TYPES.includes(upper) ? upper : null;
}

export function isValidEmployerType(value) {
  return normalizeEmployerType(value) !== null;
}

export function isEmployerNextPath(path = '') {
  return typeof path === 'string' && (path.startsWith('/recruiter') || path.startsWith('/hire'));
}

export function buildPathWithParams(path, params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function getConfiguredSocialProviders() {
  const linkedinConfigured = Boolean(
    process.env.LINKEDIN_CLIENT_ID &&
    process.env.LINKEDIN_CLIENT_SECRET &&
    process.env.LINKEDIN_REDIRECT_URI
  );

  return {
    googleVisible: true,
    linkedinConfigured,
  };
}

export function getLegacyAuthDestination(params = {}) {
  const next = typeof params.next === 'string' ? params.next : '';
  const role = typeof params.role === 'string' ? params.role.toLowerCase() : '';
  const ambiguousCallbackState = Boolean(params.authStatus || params.oauthError || params.resetError);

  if (role === 'recruiter' || role === 'employer' || isEmployerNextPath(next)) {
    return {
      type: 'redirect',
      href: buildPathWithParams(employerAuthRoutes.landing, params),
    };
  }

  if (!ambiguousCallbackState) {
    return {
      type: 'redirect',
      href: buildPathWithParams(candidateAuthRoutes.login, params),
    };
  }

  return {
    type: 'chooser',
  };
}
