export const recruiterNav = [
  { label: 'Overview', href: '/recruiter', icon: 'LayoutDashboard' },
  { label: 'Jobs', href: '/recruiter/jobs', icon: 'BriefcaseBusiness' },
  { label: 'Resume Database', href: '/recruiter/database', icon: 'Database' },
  { label: 'ATS Pipeline', href: '/recruiter/ats', icon: 'GitPullRequestArrow' },
];

export const candidateNav = [
  { label: 'Dashboard', href: '/candidate', icon: 'LayoutDashboard' },
  { label: 'AI Tools', href: '/candidate/tools', icon: 'Sparkles' },
  { label: 'Browse Jobs', href: '/candidate/jobs', icon: 'Search' },
  { label: 'Applications', href: '/candidate/applications', icon: 'ClipboardList' },
  { label: 'Resume Builder', href: '/candidate/resume-builder', icon: 'FilePenLine' },
];

export const adminNav = [
  { label: 'Overview', href: '/admin', icon: 'BarChart3' },
  { label: 'Users', href: '/admin', icon: 'Users' },
  { label: 'Subscriptions', href: '/admin', icon: 'WalletCards' },
  { label: 'System Config', href: '/admin', icon: 'Settings2' },
];

export const recruiterJobs = [
  {
    id: 'job-1',
    title: 'Frontend Engineer',
    location: 'Bengaluru',
    applicants: 42,
    status: 'OPEN',
    skillsRequired: ['React', 'Next.js', 'Tailwind'],
  },
  {
    id: 'job-2',
    title: 'Talent Operations Lead',
    location: 'Remote',
    applicants: 19,
    status: 'CLOSED',
    skillsRequired: ['ATS', 'Hiring Ops', 'Stakeholder Mgmt'],
  },
];

export const pipelineApplications = [
  { id: 'app-1', currentStage: 'APPLIED', candidate: 'Rhea Kapoor', role: 'Product Designer', timeline: 'Applied 2h ago' },
  { id: 'app-2', currentStage: 'SHORTLISTED', candidate: 'Aarav Sharma', role: 'Frontend Engineer', timeline: 'Reviewed today' },
  { id: 'app-3', currentStage: 'INTERVIEW_SCHEDULED', candidate: 'Nikhil Verma', role: 'Backend Engineer', timeline: 'Interview tomorrow 11:00 AM' },
  { id: 'app-4', currentStage: 'SELECTED', candidate: 'Shreya Singh', role: 'QA Engineer', timeline: 'Offer sent' },
  { id: 'app-5', currentStage: 'REJECTED', candidate: 'Rahul Das', role: 'Data Analyst', timeline: 'Closed last week' },
];

export const resumeDatabase = [
  { id: 'cand-1', name: 'Aarav Sharma', title: 'Full Stack Developer', location: 'Bengaluru', experience: '3 years', availability: '2 weeks', skills: ['React', 'Node.js', 'PostgreSQL'] },
  { id: 'cand-2', name: 'Meera Nair', title: 'UX Designer', location: 'Pune', experience: '5 years', availability: 'Immediate', skills: ['Figma', 'Design Systems', 'Research'] },
];

export const candidateJobs = [
  {
    id: 'cj-1',
    title: 'Frontend Engineer',
    company: 'OrbitHire',
    location: 'Bengaluru',
    type: 'Full-time',
    urgency: 'Priority role',
    description: 'Own recruiter dashboards, build polished workflows, and ship user-facing features across the hiring product suite.',
    skills: ['React', 'Next.js', 'Tailwind'],
    salary: 'INR 8L - 14L',
    match: 94,
    highlights: ['Strong frontend ownership', 'Product-facing role with recruiter workflows', 'Good fit for candidates targeting Bengaluru'],
  },
  {
    id: 'cj-2',
    title: 'Platform Recruiter',
    company: 'PeopleFlow',
    location: 'Remote',
    type: 'Full-time',
    urgency: 'New opening',
    description: 'Scale hiring for product and GTM teams with ATS rigor, stakeholder management, and data-led hiring execution.',
    skills: ['Recruiting', 'ATS', 'Stakeholders'],
    salary: 'INR 10L - 16L',
    match: 78,
    highlights: ['Remote option available', 'Good ATS process exposure', 'Best for recruiting-oriented candidates'],
  },
  {
    id: 'cj-3',
    title: 'Backend Engineer',
    company: 'CareerCraft AI',
    location: 'Hyderabad',
    type: 'Hybrid',
    urgency: 'Urgent hiring',
    description: 'Ship API modules for jobs, pipeline, search, and resume storage with performance and scale in mind.',
    skills: ['Node.js', 'PostgreSQL', 'Elasticsearch'],
    salary: 'INR 12L - 18L',
    match: 82,
    highlights: ['Backend-heavy ownership', 'Good salary band for mid-level engineers', 'Strong fit for Hyderabad preference'],
  },
  {
    id: 'cj-4',
    title: 'Full Stack Engineer',
    company: 'ScaleGrid',
    location: 'Bengaluru',
    type: 'Hybrid',
    urgency: 'High visibility',
    description: 'Build product flows across web, API, and data layers with tight iteration between design, product, and engineering.',
    skills: ['React', 'Node.js', 'PostgreSQL'],
    salary: 'INR 11L - 15L',
    match: 91,
    highlights: ['Balanced frontend and backend work', 'Location and salary both align strongly', 'Fast-moving SaaS team'],
  },
  {
    id: 'cj-5',
    title: 'Product Engineer',
    company: 'OrbitHQ',
    location: 'Pune',
    type: 'Full-time',
    urgency: 'Actively interviewing',
    description: 'Ship customer-facing features with strong frontend ownership and close collaboration with product and design.',
    skills: ['Next.js', 'Tailwind', 'Node.js'],
    salary: 'INR 9L - 13L',
    match: 87,
    highlights: ['Product-minded engineering role', 'Great fit for UI-focused candidates', 'Slightly below top-end CTC target'],
  },
];

export const candidatePreferenceProfile = {
  skills: ['React', 'Next.js', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
  preferredLocations: ['Bengaluru', 'Remote', 'Hyderabad'],
  expectedCtcLpa: 14,
  currentCtcLpa: 10,
};

export const aiRecommendedJobs = [
  {
    id: 'ai-1',
    title: 'Full Stack Engineer',
    company: 'ScaleGrid',
    location: 'Bengaluru',
    type: 'Hybrid',
    description: 'Build product flows across web, API, and data layers with balanced ownership across frontend and backend systems.',
    skills: ['React', 'Node.js', 'PostgreSQL'],
    salary: 'INR 11L - 15L',
    match: 96,
    metrics: {
      skillFit: 'High',
      locationFit: 'Exact',
      ctcFit: 'Aligned',
    },
    matchReasons: ['Strong overlap with React, Node.js, and PostgreSQL stack', 'Bengaluru is part of the preferred location profile', 'Salary range sits comfortably inside expected CTC'],
  },
  {
    id: 'ai-2',
    title: 'Frontend Engineer',
    company: 'OrbitHire',
    location: 'Bengaluru',
    type: 'Full-time',
    description: 'Own recruiter dashboards and polished workflows with strong emphasis on interface quality and product thinking.',
    skills: ['React', 'Next.js', 'Tailwind'],
    salary: 'INR 8L - 14L',
    match: 93,
    metrics: {
      skillFit: 'High',
      locationFit: 'Exact',
      ctcFit: 'Close',
    },
    matchReasons: ['Frontend stack aligns strongly with the candidate profile', 'Preferred city match improves ranking confidence', 'Salary ceiling is close to the candidate expectation'],
  },
  {
    id: 'ai-3',
    title: 'Backend Engineer',
    company: 'CareerCraft AI',
    location: 'Hyderabad',
    type: 'Hybrid',
    description: 'Ship search, jobs, pipeline, and storage APIs with a focus on scalable architecture and hiring platform workflows.',
    skills: ['Node.js', 'PostgreSQL', 'Elasticsearch'],
    salary: 'INR 12L - 18L',
    match: 88,
    metrics: {
      skillFit: 'Medium',
      locationFit: 'Preferred',
      ctcFit: 'Strong',
    },
    matchReasons: ['Backend stack has solid overlap with candidate strengths', 'Hyderabad is included in preferred locations', 'Salary band is attractive relative to current and expected CTC'],
  },
];

export const candidateApplications = [
  { id: 'ca-1', role: 'Frontend Engineer', company: 'OrbitHire', location: 'Bengaluru', status: 'Interview', tone: 'warning', date: '12 Apr 2026', summary: 'Interview scheduled with panel round next week.' },
  { id: 'ca-2', role: 'Platform Recruiter', company: 'PeopleFlow', location: 'Remote', status: 'Under review', tone: 'brand', date: '08 Apr 2026', summary: 'Application received and being reviewed by the hiring team.' },
  { id: 'ca-3', role: 'Developer Advocate', company: 'Stackwave', location: 'Mumbai', status: 'Rejected', tone: 'danger', date: '04 Apr 2026', summary: 'Role closed after first screening review.' },
];

export const resumeBuilderProfile = {
  fullName: 'Aarav Sharma',
  title: 'Full Stack Developer',
  location: 'Bengaluru',
  skills: ['React', 'Next.js', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
  projects: [
    { name: 'CareerCraft AI Platform', summary: 'Built ATS-friendly resume workflows, AI career tools, and candidate dashboard experiences.' },
    { name: 'Resume Search Engine', summary: 'Indexed profiles for fast recruiter search and shortlisting.' },
  ],
};
