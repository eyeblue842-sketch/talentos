const defaultPermissionsByRole = {
  OWNER: ['*'],
  ADMIN: ['*'],
  RECRUITER: [
    'intelligence.resume.read',
    'intelligence.resume.generate',
    'intelligence.match.read',
    'intelligence.match.generate',
    'intelligence.ranking.read',
    'intelligence.ranking.generate',
    'intelligence.candidate.read',
    'intelligence.candidate.generate',
    'intelligence.job.generate',
    'intelligence.interview.generate',
    'intelligence.search.read',
    'intelligence.search.execute',
    'intelligence.search.history.read',
    'intelligence.saved_search.read',
    'intelligence.saved_search.manage',
    'intelligence.search.use',
    'intelligence.analytics.use',
  ],
  HIRING_MANAGER: [
    'intelligence.match.read',
    'intelligence.ranking.read',
    'intelligence.candidate.read',
    'intelligence.job.generate',
    'intelligence.interview.generate',
    'intelligence.search.read',
    'intelligence.analytics.use',
  ],
  INTERVIEWER: [
    'intelligence.interview.generate',
  ],
  VIEWER: [
    'intelligence.match.read',
    'intelligence.resume.read',
    'intelligence.candidate.read',
  ],
};

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export function getUserPermissions(user) {
  if (!user) return [];

  const membershipPermissions = user.activeMembership?.permissions;
  if (Array.isArray(membershipPermissions) && membershipPermissions.length) {
    return unique(membershipPermissions);
  }

  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return ['*'];
  }

  return unique(defaultPermissionsByRole[user.activeMembership?.role || user.role] || []);
}

export function hasUserPermission(user, permission) {
  const permissions = getUserPermissions(user);
  return permissions.includes('*') || permissions.includes(permission);
}
