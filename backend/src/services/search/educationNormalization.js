const DEGREE_ALIASES = [
  { canonical: 'B.Tech', level: 'UG', values: ['btech', 'b.tech', 'bachelor of technology'] },
  { canonical: 'B.E.', level: 'UG', values: ['be', 'b.e.', 'bachelor of engineering'] },
  { canonical: 'B.Sc', level: 'UG', values: ['bsc', 'b.sc', 'bachelor of science'] },
  { canonical: 'B.Com', level: 'UG', values: ['bcom', 'b.com', 'bachelor of commerce'] },
  { canonical: 'BBA', level: 'UG', values: ['bba', 'bachelor of business administration'] },
  { canonical: 'BCA', level: 'UG', values: ['bca', 'bachelor of computer applications'] },
  { canonical: 'BA', level: 'UG', values: ['ba', 'b.a.', 'bachelor of arts'] },
  { canonical: 'LLB', level: 'UG', values: ['llb', 'l.l.b.', 'bachelor of law'] },
  { canonical: 'M.Tech', level: 'PG', values: ['mtech', 'm.tech', 'master of technology'] },
  { canonical: 'M.E.', level: 'PG', values: ['me', 'm.e.', 'master of engineering'] },
  { canonical: 'M.Sc', level: 'PG', values: ['msc', 'm.sc', 'master of science'] },
  { canonical: 'M.Com', level: 'PG', values: ['mcom', 'm.com', 'master of commerce'] },
  { canonical: 'MBA', level: 'PG', values: ['mba', 'master of business administration'] },
  { canonical: 'PGDM', level: 'PG', values: ['pgdm', 'post graduate diploma in management'] },
  { canonical: 'MCA', level: 'PG', values: ['mca', 'master of computer applications'] },
  { canonical: 'MA', level: 'PG', values: ['ma', 'm.a.', 'master of arts'] },
  { canonical: 'PhD', level: 'PPG', values: ['phd', 'ph.d.', 'doctorate', 'doctor of philosophy'] },
  { canonical: 'M.Phil', level: 'PPG', values: ['mphil', 'm.phil'] },
];

function normalized(value) {
  return String(value || '').toLowerCase().replace(/[.,/\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEducationType(value) {
  return normalized(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeDegree(value) {
  const text = normalized(value);
  if (!text) return null;
  const match = DEGREE_ALIASES.find((entry) => entry.values.some((alias) => (
    text === normalized(alias) || text.startsWith(`${normalized(alias)} `) || text.includes(` ${normalized(alias)} `)
  )));
  return match ? { canonical: match.canonical, level: match.level } : null;
}

export function normalizeEducationEntry(entry = {}) {
  const degree = String(entry.degree || entry.course || entry.qualification || entry.title || '').trim();
  const institution = String(entry.institution || entry.institute || entry.school || entry.university || '').trim();
  const type = normalizeEducationType(entry.educationType || entry.type || entry.mode || '');
  const completionYear = Number(entry.completionYear || entry.endYear || entry.year || '') || null;
  const degreeInfo = normalizeDegree(degree);
  const explicitLevel = ['UG', 'PG', 'PPG'].includes(String(entry.qualificationLevel || entry.level || '').toUpperCase())
    ? String(entry.qualificationLevel || entry.level).toUpperCase()
    : null;

  return {
    ...entry,
    degree,
    course: String(entry.course || degree).trim(),
    institution,
    educationType: type || null,
    completionYear,
    normalizedCourse: degreeInfo?.canonical || null,
    qualificationLevel: explicitLevel || degreeInfo?.level || null,
  };
}

export function normalizeEducationEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map(normalizeEducationEntry)
    .filter((entry) => entry.degree || entry.institution);
}

export function educationMatchesLevel(entries, level, query = {}) {
  const mode = String(query.mode || 'ANY').toUpperCase();
  const matching = entries.filter((entry) => entry.qualificationLevel === level);
  if (mode === 'NONE') return matching.length === 0;
  if (mode !== 'SPECIFIC') return matching.length > 0;
  return matching.some((entry) => {
    const course = String(query.course || '').trim().toLowerCase();
    const institute = String(query.institute || '').trim().toLowerCase();
    const type = normalizeEducationType(query.educationType);
    const year = entry.completionYear;
    if (course && !(entry.normalizedCourse || entry.course || entry.degree).toLowerCase().includes(course)) return false;
    if (institute && !entry.institution.toLowerCase().includes(institute)) return false;
    if (type && normalizeEducationType(entry.educationType) !== type) return false;
    if (query.completionYearFrom != null && (!year || year < Number(query.completionYearFrom))) return false;
    if (query.completionYearTo != null && (!year || year > Number(query.completionYearTo))) return false;
    return true;
  });
}
