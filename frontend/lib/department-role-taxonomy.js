// Careeriz-maintained department -> role taxonomy for the recruiter Resume Search
// "Department and Role" cascading selector. There is no backend department filter
// today (see resume-search architecture notes), so a selected role is used as a
// convenience shortcut into the existing Designation filter rather than a new
// backend concept.
export const DEPARTMENT_ROLE_TAXONOMY = [
  {
    department: 'Human Resources',
    roles: ['HR Manager', 'Talent Acquisition', 'HR Business Partner', 'HR Operations', 'Compensation & Benefits', 'Learning & Development', 'HR Generalist', 'Employee Relations Manager'],
  },
  {
    department: 'Engineering - Software & QA',
    roles: ['Software Engineer', 'Senior Software Engineer', 'Engineering Manager', 'QA Engineer', 'SDET', 'DevOps Engineer', 'Site Reliability Engineer', 'Solutions Architect', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Mobile Developer'],
  },
  {
    department: 'Data Science & Analytics',
    roles: ['Data Scientist', 'Data Analyst', 'Data Engineer', 'Machine Learning Engineer', 'Business Intelligence Analyst', 'Analytics Manager'],
  },
  {
    department: 'Product Management',
    roles: ['Product Manager', 'Senior Product Manager', 'Product Owner', 'Associate Product Manager', 'Product Analyst'],
  },
  {
    department: 'Design - UI/UX',
    roles: ['UI Designer', 'UX Designer', 'Product Designer', 'Design Manager', 'UX Researcher'],
  },
  {
    department: 'Finance & Accounting',
    roles: ['Financial Analyst', 'Accountant', 'Finance Manager', 'Controller', 'Accounts Payable Executive', 'Accounts Receivable Executive', 'FP&A Analyst'],
  },
  {
    department: 'Sales & Business Development',
    roles: ['Sales Executive', 'Account Manager', 'Business Development Manager', 'Sales Manager', 'Inside Sales Representative', 'Key Account Manager'],
  },
  {
    department: 'Marketing',
    roles: ['Marketing Manager', 'Digital Marketing Specialist', 'Content Marketing Manager', 'SEO Specialist', 'Brand Manager', 'Growth Marketer'],
  },
  {
    department: 'Customer Support & Success',
    roles: ['Customer Support Executive', 'Customer Success Manager', 'Technical Support Engineer', 'Support Team Lead'],
  },
  {
    department: 'Operations',
    roles: ['Operations Manager', 'Operations Executive', 'Supply Chain Manager', 'Logistics Coordinator', 'Process Excellence Manager'],
  },
  {
    department: 'Project & Program Management',
    roles: ['Project Manager', 'Program Manager', 'Scrum Master', 'Agile Coach', 'PMO Analyst'],
  },
  {
    department: 'Legal & Compliance',
    roles: ['Legal Counsel', 'Compliance Officer', 'Company Secretary', 'Legal Associate'],
  },
  {
    department: 'Administration & Facilities',
    roles: ['Admin Executive', 'Facilities Manager', 'Office Manager', 'Front Desk Executive'],
  },
  {
    department: 'IT & Infrastructure',
    roles: ['System Administrator', 'Network Engineer', 'IT Manager', 'Cloud Engineer', 'Database Administrator', 'Information Security Analyst'],
  },
];

export function filterDepartmentRoleTaxonomy(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return DEPARTMENT_ROLE_TAXONOMY;
  return DEPARTMENT_ROLE_TAXONOMY
    .map((group) => ({
      ...group,
      roles: group.department.toLowerCase().includes(needle)
        ? group.roles
        : group.roles.filter((role) => role.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.roles.length);
}
