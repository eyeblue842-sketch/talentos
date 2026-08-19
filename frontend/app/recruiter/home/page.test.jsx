import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import RecruiterHomePage from '@/app/recruiter/home/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children, brand, items }) => (
    <div data-testid="workspace-shell" data-brand={brand} data-nav-count={items.length}>
      {children}
    </div>
  ),
}));

vi.mock('@/app/recruiter/actions', () => ({
  createOrganisationPostAction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({
    role: 'RECRUITER',
    activeMembership: { role: 'OWNER' },
  })),
}));

vi.mock('@/lib/api', () => ({
  getCurrentOrganisation: vi.fn(async () => ({
    id: 'org-1',
    name: 'Northstar Talent Labs',
    slug: 'northstar-talent-labs',
    website: 'https://northstar.example',
    industry: 'Staffing & Recruiting',
    organisationSize: '11-50',
    headquarters: 'Bengaluru, Karnataka',
    publicDescription: 'Northstar builds specialist hiring teams for growth-stage product companies.',
    updatedAt: '2026-08-05T00:00:00.000Z',
    logoUrl: '',
  })),
  getRecruiterDashboard: vi.fn(async () => ({
    activeJobsCount: 12,
    jobsCount: 16,
    applicantsCount: 86,
    recentApplications: [
      {
        id: 'application-1',
        appliedAt: '2026-08-06T08:00:00.000Z',
        candidate: { fullName: 'Aditi Garg' },
        job: { title: 'Senior Java Developer' },
      },
    ],
    pipelineCounts: [{ stage: 'Screening', count: 18 }],
    upcomingInterviews: [{ id: 'int-1' }, { id: 'int-2' }],
    openRequisitions: 3,
    savedCandidatesCount: 24,
    pendingInvitationsCount: 2,
    offersDraftCount: 1,
    offersPendingApprovalCount: 4,
    offersReleasedCount: 2,
    offersAcceptedCount: 1,
    upcomingJoinersCount: 3,
    jobsClosingSoon: [{ id: 'job-closing-1' }],
  })),
  getNotifications: vi.fn(async () => ([
    { id: 'notification-1', readAt: null },
    { id: 'notification-2', readAt: null },
    { id: 'notification-3', readAt: '2026-08-05T00:00:00.000Z' },
  ])),
  getPublicOrganisation: vi.fn(async () => ({
    organisation: {
      id: 'org-1',
      name: 'Northstar Talent Labs',
      slug: 'northstar-talent-labs',
      website: 'https://northstar.example',
      industry: 'Staffing & Recruiting',
      organisationSize: '11-50',
      headquarters: 'Bengaluru, Karnataka',
      publicDescription: 'Northstar builds specialist hiring teams for growth-stage product companies.',
      publicLocations: ['Bengaluru, Karnataka'],
      cultureSummary: 'High-ownership hiring teams.',
      updatedAt: '2026-08-05T00:00:00.000Z',
      logoUrl: '',
    },
    recentJobs: [
      {
        id: 'job-1',
        slug: 'senior-java-developer',
        title: 'Senior Java Developer',
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        experienceMin: 7,
        experienceMax: 10,
        postedAt: '2026-08-05T00:00:00.000Z',
        skillsRequired: ['Java', 'Spring Boot'],
      },
      {
        id: 'job-2',
        slug: 'power-bi-developer',
        title: 'Power BI Developer',
        location: 'Pune',
        employmentType: 'CONTRACT',
        workplaceType: 'REMOTE',
        experienceMin: 3,
        experienceMax: 5,
        postedAt: '2026-08-04T00:00:00.000Z',
        skillsRequired: ['Power BI', 'SQL'],
      },
    ],
    jobs: {
      items: [],
      meta: { total: 2, page: 1, pageSize: 12, pageCount: 1 },
    },
    posts: [
      {
        id: 'post-1',
        content: 'We are expanding our product engineering hiring this quarter.',
        createdAt: '2026-08-05T00:00:00.000Z',
        publishedAt: '2026-08-05T00:00:00.000Z',
      },
    ],
    peopleInsights: {
      sampleSize: 12,
      locations: [{ label: 'Bengaluru', count: 6 }],
      education: [{ label: 'Engineering', count: 7 }],
      roles: [{ label: 'Software Engineer', count: 5 }],
      experienceLevels: [{ label: '6-10 years', count: 4 }],
      skills: [{ label: 'Java', count: 6 }],
    },
    publicInsights: {
      activeJobCount: 2,
      hiringLocations: [{ label: 'Bengaluru', count: 1 }],
      commonRoles: [{ label: 'Senior Java Developer', count: 1 }],
      commonSkills: [{ label: 'Java', count: 1 }],
    },
  })),
}));

describe('RecruiterHomePage', () => {
  test('renders the recruiter home organisation workspace from existing data', async () => {
    render(await RecruiterHomePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-brand', 'Northstar Talent Labs');
    expect(screen.getByRole('heading', { name: 'Recruiter home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Northstar Talent Labs' })).toBeInTheDocument();
    expect(screen.getByText('Staffing & Recruiting')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru, Karnataka')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Company website' })).toHaveAttribute('href', 'https://northstar.example');
    expect(screen.getByRole('link', { name: 'Edit company profile' })).toHaveAttribute('href', '/recruiter/onboarding');
  });

  test('shows hiring snapshot, recent jobs, people highlights, and notification bell', async () => {
    render(await RecruiterHomePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'Hiring snapshot' })).toBeInTheDocument();
    expect(screen.getByText('Open jobs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent job openings' })).toBeInTheDocument();
    expect(screen.getAllByText('Senior Java Developer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power BI Developer').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'People highlights' })).toBeInTheDocument();
    expect(screen.getByText(/Insights based on 12 Careeriz profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/We are expanding our product engineering hiring this quarter/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications, 2 unread' })).toHaveAttribute('href', '/recruiter/notifications');
  });

  test('does not use hardcoded organisation content', async () => {
    render(await RecruiterHomePage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByText('Sivanta Technologies')).not.toBeInTheDocument();
    expect(screen.queryByText('TechAffinity Consulting Pvt Ltd')).not.toBeInTheDocument();
  });
});
