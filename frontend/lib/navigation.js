import { isFeatureEnabled } from '@/lib/feature-flags';

const bulkResumeImportEnabled = isFeatureEnabled('bulkResumeImport');

export const recruiterNav = [
  { label: 'Home', href: '/recruiter/home', icon: 'LayoutDashboard', exact: true },
  {
    label: 'Recruitment',
    icon: 'BriefcaseBusiness',
    children: [
      { id: 'recruitment-overview', label: 'Overview', href: '/recruiter', icon: 'LayoutDashboard', exact: true },
      { id: 'recruitment-jobs', label: 'Job Posts', href: '/recruiter/jobs', icon: 'ClipboardList' },
      { id: 'recruitment-job-responses', label: 'Job Responses', href: '/recruiter/job-responses', icon: 'GitPullRequestArrow' },
      { id: 'recruitment-network', label: 'Network', href: '/recruiter/network', icon: 'Users' },
      { id: 'recruitment-messages', label: 'Messages', href: '/recruiter/messages', icon: 'Mail' },
      { id: 'recruitment-resume-search', label: 'Resume Search', href: '/recruiter/database', icon: 'Database' },
      { id: 'recruitment-ats', label: 'ATS Pipeline', href: '/recruiter/ats', icon: 'GitPullRequestArrow' },
      { id: 'recruitment-interviews', label: 'Interviews', href: '/recruiter/interviews', icon: 'CalendarDays' },
      ...(bulkResumeImportEnabled ? [{ id: 'recruitment-import', label: 'Bulk Resume Import', href: '/recruiter/candidates/import', icon: 'ClipboardList' }] : []),
    ],
  },
  { label: 'Members', href: '/recruiter/members', icon: 'Users' },
  { label: 'Billing', href: '/recruiter/billing', icon: 'WalletCards' },
  { label: 'Notifications', href: '/recruiter/notifications', icon: 'Bell' },
  { label: 'Settings', href: '/recruiter/settings', icon: 'Settings2' },
];

export const candidateNav = [
  { label: 'Dashboard', href: '/candidate/dashboard', icon: 'LayoutDashboard' },
  { label: 'Find Jobs', href: '/candidate/jobs', icon: 'Search' },
  { label: 'Network', href: '/candidate/network', icon: 'Users' },
  { label: 'Messages', href: '/candidate/messages', icon: 'Mail' },
  { label: 'Saved Jobs', href: '/candidate/saved-jobs', icon: 'BriefcaseBusiness' },
  { label: 'Applications', href: '/candidate/applications', icon: 'ClipboardList' },
  { label: 'Interviews', href: '/candidate/interviews', icon: 'CalendarDays' },
  { label: 'Offers', href: '/candidate/offers', icon: 'WalletCards' },
  { label: 'Resumes', href: '/candidate/resumes', icon: 'FilePenLine' },
  { label: 'Profile', href: '/candidate/profile', icon: 'Users' },
  { label: 'Notifications', href: '/candidate/notifications', icon: 'BarChart3' },
  { label: 'Settings', href: '/candidate/settings', icon: 'Settings2' },
];

export const adminNav = [
  { label: 'Overview', href: '/admin', icon: 'LayoutDashboard' },
  { label: 'Organisation', href: '/admin/organisation', icon: 'Building2' },
  { label: 'Users', href: '/admin/users', icon: 'Users' },
  { label: 'Roles', href: '/admin/roles', icon: 'ShieldCheck' },
  { label: 'Settings', href: '/admin/settings', icon: 'Settings2' },
  { label: 'Workflow', href: '/admin/workflow', icon: 'GitPullRequestArrow' },
  { label: 'Audit', href: '/admin/audit', icon: 'ScrollText' },
  { label: 'Notifications', href: '/admin/notifications', icon: 'BellRing' },
  { label: 'Background', href: '/admin/background-jobs', icon: 'ServerCog' },
  { label: 'Analytics', href: '/admin/analytics', icon: 'BarChart3' },
  ...(bulkResumeImportEnabled ? [{ label: 'Bulk Resume Import', href: '/admin/candidates/import', icon: 'ClipboardList' }] : []),
  { label: 'Intelligence', href: '/admin/intelligence', icon: 'Sparkles' },
  { label: 'Feature Flags', href: '/admin/feature-flags', icon: 'ToggleRight' },
  { label: 'Lookups', href: '/admin/lookups', icon: 'ListFilter' },
];

export function getNavigationForRole(role) {
  if (role === 'CANDIDATE' || role === 'CANDIDATE_ADMIN') return candidateNav;
  if (role === 'RECRUITER' || role === 'RECRUITER_ADMIN') return recruiterNav;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN') return adminNav;
  return [];
}
