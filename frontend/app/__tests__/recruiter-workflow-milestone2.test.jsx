import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { isValidElement } from 'react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import RecruiterOnboardingPage from '@/app/recruiter/onboarding/page';
import RecruiterMembersPage from '@/app/recruiter/members/page';
import RecruiterDashboardPage from '@/app/recruiter/page';
import InvitationAcceptPage from '@/app/auth/invitations/accept/page';
import { RecruiterOnboardingForm } from '@/components/sections/recruiter-onboarding-form';

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

    expect(screen.getByRole('heading', { name: /organisation and recruiter details/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument();
    expect(screen.getByDisplayValue('acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete workspace setup/i })).toBeInTheDocument();
    expect(screen.queryByText('Recruiter Onboarding')).not.toBeInTheDocument();
    expect(screen.getByRole('main').querySelector('.max-w-4xl')).not.toBeNull();
  });

  test('onboarding retains submitted values and renders inline validation without a server-component error', async () => {
    const action = vi.fn(async () => ({
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: { companyWebsite: ['Enter a valid website such as https://example.com.'] },
      formErrors: [],
      values: { organisationName: 'Edited Acme', workspaceSlug: 'acme', companyWebsite: 'bad-url' },
    }));
    render(<RecruiterOnboardingForm action={action} invitationRoles={['RECRUITER']} initialValues={{ organisationName: 'Acme', workspaceSlug: 'acme', companyWebsite: '' }} />);
    fireEvent.submit(screen.getByRole('button', { name: /complete workspace setup/i }).closest('form'));
    await waitFor(() => expect(screen.getByText(/valid website such as/i)).toBeInTheDocument());
    expect(screen.getByDisplayValue('Edited Acme')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bad-url')).toBeInTheDocument();
    expect(screen.queryByText(/stack|internal provider/i)).not.toBeInTheDocument();
  });

  test('onboarding passes only serializable data props to components, including forwardRef icons', async () => {
    function assertData(value) {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach(assertData);
        return;
      }
      if (typeof value === 'object') {
        expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
        Object.values(value).forEach(assertData);
        return;
      }
      expect(['string', 'number', 'boolean']).toContain(typeof value);
    }

    function inspectBoundary(node) {
      if (Array.isArray(node)) {
        node.forEach(inspectBoundary);
        return;
      }
      if (!isValidElement(node)) return;
      if (typeof node.type !== 'string') {
        Object.entries(node.props).forEach(([name, value]) => {
          if (name !== 'children') assertData(value);
        });
      }
      inspectBoundary(node.props.children);
    }

    const page = await RecruiterOnboardingPage({ searchParams: Promise.resolve({}) });
    inspectBoundary(page);
    render(page);
    expect(screen.getByRole('button', { name: /complete workspace setup/i }).querySelector('svg')).not.toBeNull();
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
