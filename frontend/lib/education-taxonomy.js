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

// Degree -> specialization options, so the Specialization picker changes with
// the chosen Degree (an engineering degree offers CS/Mechanical/Civil…, a
// commerce degree offers Accounting/Finance/Taxation…) instead of one fixed
// list for every degree. Not exhaustive - unknown degrees fall back to
// GENERAL_SPECIALIZATIONS via specializationsForDegree().
const ENGINEERING_SPECIALIZATIONS = ['Computer Science', 'Information Technology', 'Electronics & Communication', 'Electrical & Electronics', 'Mechanical', 'Civil', 'Chemical', 'Aerospace', 'Automobile', 'Biotechnology', 'Data Science / AI & ML', 'Instrumentation'];
const SCIENCE_SPECIALIZATIONS = ['Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Statistics', 'Biology', 'Biotechnology', 'Microbiology', 'Environmental Science'];
const COMMERCE_SPECIALIZATIONS = ['Accounting', 'Finance', 'Banking', 'Taxation', 'Auditing', 'Business Analytics', 'Economics', 'Cost Accounting'];
const MANAGEMENT_SPECIALIZATIONS = ['Marketing', 'Finance', 'Human Resources', 'Operations', 'Information Technology', 'Business Analytics', 'International Business', 'Supply Chain', 'Entrepreneurship'];
const ARTS_SPECIALIZATIONS = ['English', 'Economics', 'Psychology', 'Political Science', 'Sociology', 'History', 'Journalism & Mass Communication', 'Public Administration'];
const COMPUTER_APP_SPECIALIZATIONS = ['Software Development', 'Data Science', 'Cyber Security', 'Cloud Computing', 'Networking', 'Information Systems'];
const LAW_SPECIALIZATIONS = ['Corporate Law', 'Criminal Law', 'Constitutional Law', 'Intellectual Property', 'Taxation Law', 'International Law'];
const MEDICAL_SPECIALIZATIONS = ['General Medicine', 'Surgery', 'Pediatrics', 'Orthopaedics', 'Dermatology', 'Radiology', 'Anaesthesiology'];
const PHARMACY_SPECIALIZATIONS = ['Pharmaceutics', 'Pharmacology', 'Pharmaceutical Chemistry', 'Pharmacognosy', 'Quality Assurance'];

export const GENERAL_SPECIALIZATIONS = ['Computer Science', 'Information Technology', 'Human Resources', 'Finance', 'Marketing', 'Operations'];

const DEGREE_SPECIALIZATIONS = {
  'B.Tech': ENGINEERING_SPECIALIZATIONS, 'B.E.': ENGINEERING_SPECIALIZATIONS, 'M.Tech': ENGINEERING_SPECIALIZATIONS, 'M.E.': ENGINEERING_SPECIALIZATIONS,
  'B.Sc': SCIENCE_SPECIALIZATIONS, 'M.Sc': SCIENCE_SPECIALIZATIONS,
  BCA: COMPUTER_APP_SPECIALIZATIONS, MCA: COMPUTER_APP_SPECIALIZATIONS,
  'B.Com': COMMERCE_SPECIALIZATIONS, 'M.Com': COMMERCE_SPECIALIZATIONS,
  BBA: MANAGEMENT_SPECIALIZATIONS, BBM: MANAGEMENT_SPECIALIZATIONS, MBA: MANAGEMENT_SPECIALIZATIONS, PGDM: MANAGEMENT_SPECIALIZATIONS,
  'B.A.': ARTS_SPECIALIZATIONS, 'M.A.': ARTS_SPECIALIZATIONS,
  LLB: LAW_SPECIALIZATIONS, 'BA LLB': LAW_SPECIALIZATIONS, LLM: LAW_SPECIALIZATIONS,
  MBBS: MEDICAL_SPECIALIZATIONS, MD: MEDICAL_SPECIALIZATIONS, MS: MEDICAL_SPECIALIZATIONS,
  'B.Pharm': PHARMACY_SPECIALIZATIONS, 'M.Pharm': PHARMACY_SPECIALIZATIONS,
};

// Returns specialization strings for a degree/course; GENERAL_SPECIALIZATIONS
// when the degree is unknown, blank, "Any" or "Other".
export function specializationsForDegree(course) {
  if (!course || course === 'Any' || course === 'ANY' || course === 'Other' || course === 'OTHER') return GENERAL_SPECIALIZATIONS;
  return DEGREE_SPECIALIZATIONS[course] || GENERAL_SPECIALIZATIONS;
}

// CascadeSelect nodes for a level: category (branch) -> course (leaf). Leaf
// values are the exact course strings stored in candidateQualifications
// .educationCourse, so saved values keep matching.
export function educationCourseTree(level) {
  return (EDUCATION_TAXONOMY[level] || []).map((group) => ({
    label: group.category,
    children: group.courses.map((course) => ({ label: course, value: course })),
  }));
}

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
