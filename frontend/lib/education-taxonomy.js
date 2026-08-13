// Careeriz-maintained UG/PG/PPG education taxonomy for the recruiter Resume Search
// "Education Details" structured selector. Levels mirror the backend's
// backend/src/services/search/educationNormalization.js taxonomy, which only
// recognizes UG, PG and PPG (postgraduate + doctorate degrees both normalize
// into PPG - there is no separate "Doctorate" bucket server-side).
export const EDUCATION_LEVELS = [
  { value: 'ug', label: 'UG Qualification' },
  { value: 'pg', label: 'PG Qualification' },
  { value: 'ppg', label: 'PPG / Doctorate Qualification' },
];

export const EDUCATION_TAXONOMY = {
  ug: [
    { category: 'Engineering', courses: ['B.Tech', 'B.E.', 'B.Arch'] },
    { category: 'Science', courses: ['B.Sc', 'BCA'] },
    { category: 'Commerce & Management', courses: ['B.Com', 'BBA', 'BBM'] },
    { category: 'Arts & Humanities', courses: ['B.A.', 'BFA', 'BSW'] },
    { category: 'Medicine & Allied', courses: ['MBBS', 'BDS', 'B.Pharm', 'BPT'] },
    { category: 'Law', courses: ['LLB', 'BA LLB'] },
  ],
  pg: [
    { category: 'Engineering', courses: ['M.Tech', 'M.E.'] },
    { category: 'Science', courses: ['M.Sc', 'MCA'] },
    { category: 'Management', courses: ['MBA', 'PGDM', 'M.Com'] },
    { category: 'Arts & Humanities', courses: ['M.A.', 'MSW'] },
    { category: 'Medicine & Allied', courses: ['MD', 'MS', 'M.Pharm'] },
    { category: 'Law', courses: ['LLM'] },
  ],
  ppg: [
    { category: 'Doctorate', courses: ['PhD', 'Doctor of Science (D.Sc)', 'Doctor of Medicine (Higher)'] },
    { category: 'Postgraduate Diplomas', courses: ['M.Phil', 'Post Doctoral Fellowship'] },
  ],
};

export const EDUCATION_TYPES = ['Full Time', 'Part Time', 'Correspondence / Distance Learning', 'Executive'];

export function filterEducationCourses(level, query) {
  const groups = EDUCATION_TAXONOMY[level] || [];
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      ...group,
      courses: group.category.toLowerCase().includes(needle)
        ? group.courses
        : group.courses.filter((course) => course.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.courses.length);
}
