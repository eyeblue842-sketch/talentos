// Careeriz-maintained curated skills list for the recruiter Job Post "Add
// Skills" selector. This is a suggestion/autocomplete source only - the
// product has always allowed free-text skills (see candidate-profile-form's
// comma-separated skills input and Job.skillsRequired: String[]), so a
// skill not found here can still be added as a custom entry. Duplicate
// prevention is case-insensitive and happens at the selector, not here.
export const SKILLS_TAXONOMY = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby',
  'Kotlin', 'Swift', 'Scala', 'R', 'MATLAB', 'Perl', 'Objective-C', 'Dart',
  'React', 'React Native', 'Angular', 'Vue.js', 'Next.js', 'Nuxt.js', 'Svelte', 'Redux',
  'HTML5', 'CSS3', 'Tailwind CSS', 'Sass', 'Bootstrap', 'jQuery', 'Webpack', 'Vite',
  'Node.js', 'Express.js', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Spring MVC',
  'Ruby on Rails', 'Laravel', '.NET', '.NET Core', 'ASP.NET', 'GraphQL', 'REST API', 'gRPC',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB',
  'Oracle Database', 'SQL Server', 'SQLite', 'Firebase', 'Snowflake', 'BigQuery',
  'AWS', 'Microsoft Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes', 'Terraform',
  'Ansible', 'Jenkins', 'CI/CD', 'GitLab CI', 'GitHub Actions', 'Linux', 'Bash Scripting',
  'Git', 'Microservices', 'System Design', 'Data Structures', 'Algorithms', 'Design Patterns',
  'Machine Learning', 'Deep Learning', 'Natural Language Processing', 'Computer Vision',
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy', 'Data Analysis', 'Data Engineering',
  'Apache Spark', 'Apache Kafka', 'Airflow', 'ETL', 'Power BI', 'Tableau', 'Excel',
  'Selenium', 'Cypress', 'Playwright', 'Jest', 'Manual Testing', 'Automation Testing', 'JIRA',
  'Android Development', 'iOS Development', 'Flutter', 'Unity', 'Unreal Engine',
  'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Wireframing', 'Prototyping', 'User Research',
  'Product Management', 'Agile', 'Scrum', 'Kanban', 'Stakeholder Management', 'Roadmapping',
  'Project Management', 'Business Analysis', 'Requirement Gathering', 'Six Sigma',
  'Digital Marketing', 'SEO', 'SEM', 'Content Marketing', 'Social Media Marketing', 'Google Ads',
  'Email Marketing', 'Marketing Automation', 'Brand Management', 'Copywriting',
  'Sales', 'Business Development', 'Account Management', 'CRM', 'Salesforce', 'HubSpot',
  'Financial Modeling', 'Financial Analysis', 'Accounting', 'Taxation', 'Auditing', 'SAP',
  'SAP FICO', 'SAP MM', 'SAP ABAP', 'Tally', 'QuickBooks', 'Budgeting', 'Investment Analysis',
  'Human Resources', 'Talent Acquisition', 'Recruitment', 'HRIS', 'Payroll', 'Onboarding',
  'Employee Relations', 'Compensation & Benefits', 'Performance Management', 'HR Analytics',
  'Supply Chain Management', 'Logistics', 'Procurement', 'Inventory Management', 'Vendor Management',
  'Customer Support', 'Customer Success', 'Technical Support', 'Help Desk', 'Zendesk',
  'Content Writing', 'Technical Writing', 'Editing', 'Proofreading', 'Blogging',
  'Legal Drafting', 'Contract Management', 'Compliance', 'Corporate Law', 'Intellectual Property',
  'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'AutoCAD', 'SolidWorks',
  'Nursing', 'Patient Care', 'Clinical Research', 'Pharmacology', 'Medical Coding',
  'Teaching', 'Curriculum Development', 'Instructional Design', 'E-Learning',
  'Communication Skills', 'Leadership', 'Team Management', 'Problem Solving', 'Critical Thinking',
  'Time Management', 'Negotiation', 'Presentation Skills', 'Cross-functional Collaboration',
];

export function filterSkills(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return SKILLS_TAXONOMY;
  return SKILLS_TAXONOMY.filter((skill) => skill.toLowerCase().includes(needle));
}
