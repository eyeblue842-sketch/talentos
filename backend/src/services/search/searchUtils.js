export function normalizeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function daysAgo(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
}

export function buildDbWhere(filters = {}) {
  const keyword = normalizeString(filters.keyword || filters.booleanQuery);
  const or = [];
  if (keyword) {
    or.push(
      { fullName: { contains: keyword, mode: 'insensitive' } },
      { headline: { contains: keyword, mode: 'insensitive' } },
      { currentTitle: { contains: keyword, mode: 'insensitive' } },
      { summary: { contains: keyword, mode: 'insensitive' } },
    );
  }

  const designation = normalizeString(filters.designation);
  if (designation) {
    or.push(
      { currentTitle: { contains: designation, mode: 'insensitive' } },
      { headline: { contains: designation, mode: 'insensitive' } },
    );
  }

  const location = normalizeString(filters.location);
  const minExperience = normalizeNumber(filters.minExperience);
  const maxExperience = normalizeNumber(filters.maxExperience);
  const currentSalary = normalizeNumber(filters.currentSalary);
  const expectedSalary = normalizeNumber(filters.expectedSalary);
  const source = normalizeString(filters.source);
  const profileStatus = normalizeString(filters.profileStatus);

  return {
    OR: or.length ? or : undefined,
    source: source || undefined,
    profileStatus: profileStatus || undefined,
    location: location ? { contains: location, mode: 'insensitive' } : undefined,
    totalExperience: minExperience != null || maxExperience != null
      ? {
          gte: minExperience != null ? minExperience : undefined,
          lte: maxExperience != null ? maxExperience : undefined,
        }
      : undefined,
    availability: normalizeString(filters.availability) || undefined,
    willingToRelocate: normalizeString(filters.relocation).toLowerCase() === 'open'
      ? true
      : normalizeString(filters.relocation).toLowerCase() === 'not open'
        ? false
        : undefined,
    currentCtcLpa: currentSalary != null ? { gte: currentSalary } : undefined,
    expectedCtcLpa: expectedSalary != null ? { lte: expectedSalary } : undefined,
    workAuthorization: normalizeString(filters.workAuthorization)
      ? { contains: normalizeString(filters.workAuthorization), mode: 'insensitive' }
      : undefined,
    updatedAt: normalizeString(filters.resumeFreshness) === 'Last 7 days'
      ? { gte: daysAgo(7) }
      : normalizeString(filters.resumeFreshness) === 'Last 30 days'
        ? { gte: daysAgo(30) }
        : normalizeString(filters.resumeFreshness) === 'Last 90 days'
          ? { gte: daysAgo(90) }
          : undefined,
    lastActiveAt: normalizeString(filters.lastActive) === 'Today'
      ? { gte: daysAgo(1) }
      : normalizeString(filters.lastActive) === 'Last 7 days'
        ? { gte: daysAgo(7) }
        : normalizeString(filters.lastActive) === 'Last 30 days'
          ? { gte: daysAgo(30) }
          : undefined,
    importedAt: normalizeString(filters.importedSince)
      ? { gte: new Date(filters.importedSince) }
      : undefined,
  };
}

export function extractEducationEntries(candidate) {
  return Array.isArray(candidate.resumeBuilder?.education) ? candidate.resumeBuilder.education : [];
}

export function extractExperienceEntries(candidate) {
  return Array.isArray(candidate.resumeBuilder?.experience) ? candidate.resumeBuilder.experience : [];
}

export function buildRecentSearchLabel(filters) {
  const parts = [
    normalizeString(filters.keyword || filters.booleanQuery),
    normalizeString(filters.location),
    normalizeString(filters.skills),
  ].filter(Boolean);

  return parts.length ? parts.join(' | ').slice(0, 120) : 'Resume search';
}

export function sanitizeSearchQuery(rawQuery = {}) {
  return Object.fromEntries(
    Object.entries(rawQuery)
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  );
}
