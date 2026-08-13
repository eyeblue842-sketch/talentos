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

  const locations = normalizeStringArray(filters.locations || filters.location);
  const locationVariants = locations.length === 1 ? locationSearchVariants(locations[0]) : [];
  const location = locationVariants.length === 1 ? locationVariants[0] : '';
  const minExperience = normalizeNumber(filters.minExperience);
  const maxExperience = normalizeNumber(filters.maxExperience);
  const currentSalary = normalizeNumber(filters.currentSalary ?? filters.salaryMin);
  const currentSalaryMax = normalizeNumber(filters.salaryMax);
  const expectedSalary = normalizeNumber(filters.expectedSalary);
  const source = normalizeString(filters.source);
  const profileStatus = normalizeString(filters.profileStatus);

  return {
    OR: or.length ? or : undefined,
    source: source || undefined,
    profileStatus: profileStatus || undefined,
    location: location ? { contains: location, mode: 'insensitive' } : undefined,
    AND: locations.length > 1
      ? [{ OR: locations.flatMap((item) => locationSearchVariants(item).map((variant) => ({ location: { contains: variant, mode: 'insensitive' } }))) }]
      : locationVariants.length > 1
        ? [{ OR: locationVariants.map((variant) => ({ location: { contains: variant, mode: 'insensitive' } })) }]
        : undefined,
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
    currentCtcLpa: currentSalary != null || currentSalaryMax != null
      ? {
          gte: currentSalary != null ? currentSalary : undefined,
          lte: currentSalaryMax != null ? currentSalaryMax : undefined,
        }
      : undefined,
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
    lastActiveAt: filters.activeWithin != null
      ? { gte: daysAgo(Number(filters.activeWithin)) }
      : normalizeString(filters.lastActive) === 'Today'
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
  const entries = Array.isArray(candidate.educationEntries)
    ? candidate.educationEntries
    : candidate.resumeBuilder?.education;
  return Array.isArray(entries) ? entries : [];
}

export function extractExperienceEntries(candidate) {
  const entries = Array.isArray(candidate.experienceEntries)
    ? candidate.experienceEntries
    : candidate.resumeBuilder?.experience;
  return Array.isArray(entries) ? entries : [];
}

const LOCATION_ALIASES = new Map([
  ['bangalore', 'bengaluru'],
  ['bengaluru', 'bengaluru'],
  ['bombay', 'mumbai'],
  ['mumbai', 'mumbai'],
  ['gurgaon', 'gurugram'],
  ['gurugram', 'gurugram'],
  ['calcutta', 'kolkata'],
  ['cochin', 'kochi'],
  ['vizag', 'visakhapatnam'],
  ['baroda', 'vadodara'],
  ['trivandrum', 'thiruvananthapuram'],
]);

const COUNTRY_ALIASES = new Map([
  ['us', 'united states'],
  ['usa', 'united states'],
  ['uk', 'united kingdom'],
  ['uae', 'united arab emirates'],
]);

export function normalizeLocation(value) {
  const text = normalizeString(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return '';
  const city = text.split(',')[0].trim();
  return LOCATION_ALIASES.get(city) || city;
}

export function locationSearchVariants(value) {
  const normalizedValue = normalizeLocation(value);
  const original = normalizeString(value);
  if (!normalizedValue || original.includes(',')) return [original];
  const aliases = [...LOCATION_ALIASES.entries()]
    .filter(([, canonical]) => canonical === normalizedValue)
    .map(([alias]) => alias);
  return [...new Set([original, normalizedValue, ...aliases])];
}

export function locationMatches(value, requested) {
  const candidate = normalizeLocation(value);
  const query = normalizeLocation(requested);
  return Boolean(candidate && query && (candidate === query || candidate.startsWith(query) || query.startsWith(candidate)));
}

export function normalizeCountry(value) {
  const text = normalizeString(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return COUNTRY_ALIASES.get(text) || text;
}

export function countryMatches(value, requested) {
  const candidate = normalizeCountry(value);
  const query = normalizeCountry(requested);
  return Boolean(candidate && query && candidate === query);
}

export function normalizeCompany(value) {
  return normalizeString(value).toLowerCase()
    .replace(/[.,]+/g, ' ')
    .replace(/\b(private limited|pvt ltd|private ltd|limited|ltd|llp|incorporated|inc|corporation|corp)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
