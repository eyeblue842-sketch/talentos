export const recruiterNav = [
  { label: 'Overview', href: '/recruiter', icon: 'LayoutDashboard' },
  { label: 'Jobs', href: '/recruiter/jobs', icon: 'BriefcaseBusiness' },
  { label: 'Requisitions', href: '/recruiter/requisitions', icon: 'ClipboardList' },
  { label: 'Resume Database', href: '/recruiter/database', icon: 'Database' },
  { label: 'ATS Pipeline', href: '/recruiter/ats', icon: 'GitPullRequestArrow' },
  { label: 'Members', href: '/recruiter/members', icon: 'Users' },
  { label: 'Notifications', href: '/recruiter/notifications', icon: 'BarChart3' },
  { label: 'Settings', href: '/recruiter/settings', icon: 'Settings2' },
];

export const candidateNav = [
  { label: 'Dashboard', href: '/candidate/dashboard', icon: 'LayoutDashboard' },
  { label: 'Jobs', href: '/candidate/jobs', icon: 'Search' },
  { label: 'Saved Jobs', href: '/candidate/saved-jobs', icon: 'BriefcaseBusiness' },
  { label: 'Applications', href: '/candidate/applications', icon: 'ClipboardList' },
  { label: 'Notifications', href: '/candidate/notifications', icon: 'BarChart3' },
  { label: 'AI Tools', href: '/candidate/tools', icon: 'Sparkles' },
  { label: 'Resume', href: '/candidate/resume-builder', icon: 'FilePenLine' },
  { label: 'Profile', href: '/candidate/profile', icon: 'Users' },
  { label: 'Settings', href: '/candidate/settings', icon: 'Settings2' },
];

export const adminNav = [
  { label: 'Overview', href: '/admin', icon: 'LayoutDashboard' },
];

export function getNavigationForRole(role) {
  if (role === 'CANDIDATE') return candidateNav;
  if (role === 'RECRUITER') return recruiterNav;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return adminNav;
  return [];
}
