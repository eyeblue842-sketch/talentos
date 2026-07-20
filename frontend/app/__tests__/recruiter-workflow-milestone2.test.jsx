import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import RecruiterOnboardingPage from '@/app/recruiter/onboarding/page';
import RecruiterMembersPage from '@/app/recruiter/members/page';
import RecruiterDashboardPage from '@/app/recruiter/page';
import InvitationAcceptPage from '@/app/auth/invitations/accept/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/recruiter'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => null),
}));

vi.mock('@/lib/api', () => ({
  getRecruiterOnboardingState: vi.fn(async () => ({
    organisation: { id: 'org-1', name: 'Acme', slug: 'acme', website: 'https://acme.test', industry: 'Software', organisationSize: '51-200', headquarters: 'Bengaluru' },
    recruiterProfile: { companyName: 'Acme', industryDomain: 'Software', companySize: '51-200', headquartersLocation: 'Bengaluru', designation: 'Lead Recruiter', website: 'https://acme.test', profileCompleted: false },
    onboardingCompleted: false,
    membershipRole: 'OWNER',
  })),
  getCurrentOrganisation: vi.fn(async () => ({ id: 'org-1', name: 'Acme', slug: 'acme' })),
  getOrganisationMembers: vi.fn(async () => ([
    { id: 'mem-1', role: 'OWNER', status: 'ACTIVE', createdAt: '2026-07-01T00:00:00.000Z', user: { email: 'owner@acme.test' } },
  ])),
  getOrganisationInvitations: vi.fn(async () => ([
    { id: 'invite-1', email: 'new@acme.test', role: 'RECRUITER', status: 'PENDING', createdAt: '2026-07-18T00:00:00.000Z', expiresAt: '2026-07-27T00:00:00.000Z' },
  ])),
  getRecruiterDashboard: vi.fn(async () => ({
    activeJobsCount: 0,
    jobsCount: 0,
    applicantsCount: 0,
    recentApplications: [],
    openRequisitions: 0,
    savedCandidatesCount: 0,
    upcomingInterviews: [],
    jobsClosingSoon: [],
  })),
  getRecruiterJobs: vi.fn(async () => []),
  getInvitationTokenDetail: vi.fn(async () => ({
    organisation: { name: 'Acme' },
    role: 'RECRUITER',
    expiresAt: '2026-07-27T00:00:00.000Z',
  })),
}));

describe('Milestone 2 recruiter workflow pages', () => {
  beforeEach(async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    vi.mocked(getCurrentUser).mockResolvedValue({
      role: 'RECRUITER',
      activeMembership: { role: 'OWNER' },
    });
  });

  test('recruiter onboarding renders real workspace fields', async () => {
    render(await RecruiterOnboardingPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: /complete your workspace/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument();
    expect(screen.getByDisplayValue('acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete workspace setup/i })).toBeInTheDocument();
  });

  test('members page shows active members and pending invitations', async () => {
    render(await RecruiterMembersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('owner@acme.test')).toBeInTheDocument();
    expect(screen.getByText('new@acme.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send invitation/i })).toBeInTheDocument();
  });

  test('invitation acceptance page exposes accept action for signed-in recruiters', async () => {
    render(await InvitationAcceptPage({ searchParams: Promise.resolve({ token: 'valid-token' }) }));

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument();
  });

  test('dashboard shows the recruiter workspace empty-state guidance', async () => {
    render(await RecruiterDashboardPage());

    expect(screen.getByText(/start this workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/complete onboarding, open a requisition, create the first job/i)).toBeInTheDocument();
  });
});
