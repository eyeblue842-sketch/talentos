import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import RecruiterMembersPage from './page';

const getCurrentUserMock = vi.fn();
const getCurrentOrganisationMock = vi.fn();
const getOrganisationMembersMock = vi.fn();
const getOrganisationInvitationsMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args) => getCurrentUserMock(...args),
}));

vi.mock('@/lib/api', () => ({
  getCurrentOrganisation: (...args) => getCurrentOrganisationMock(...args),
  getOrganisationMembers: (...args) => getOrganisationMembersMock(...args),
  getOrganisationInvitations: (...args) => getOrganisationInvitationsMock(...args),
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children }) => <div data-testid="workspace-shell">{children}</div>,
}));

vi.mock('../actions', () => ({
  inviteOrganisationMemberAction: vi.fn(),
  resendOrganisationInvitationAction: { bind: () => vi.fn() },
  revokeOrganisationInvitationAction: { bind: () => vi.fn() },
}));

function baseMocks({ activeMembershipRole }) {
  getCurrentUserMock.mockResolvedValue({
    id: 'user-1',
    role: 'RECRUITER_ADMIN',
    activeMembership: { role: activeMembershipRole },
  });
  getCurrentOrganisationMock.mockResolvedValue({ id: 'org-1', name: 'Sivanta Technologies', slug: 'sivantatechnologies' });
  getOrganisationMembersMock.mockResolvedValue([
    { id: 'm1', user: { email: 'sales@sivantatechnologies.com' }, role: 'OWNER', status: 'ACTIVE', createdAt: '2026-07-21T00:00:00.000Z' },
  ]);
  getOrganisationInvitationsMock.mockResolvedValue([
    { id: 'inv1', email: 'newhire@sivantatechnologies.com', role: 'RECRUITER', status: 'PENDING', createdAt: '2026-08-01T00:00:00.000Z', expiresAt: '2026-08-08T00:00:00.000Z' },
  ]);
}

describe('recruiter members page: owner-only controls', () => {
  test('RECRUITER_ADMIN with an OWNER membership sees invite and manage controls', async () => {
    baseMocks({ activeMembershipRole: 'OWNER' });

    render(await RecruiterMembersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(screen.queryByText('Access limited')).not.toBeInTheDocument();
  });

  test('a normal RECRUITER (non-owner, non-admin membership) does not see invite or manage controls', async () => {
    baseMocks({ activeMembershipRole: 'RECRUITER' });

    render(await RecruiterMembersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.getByText('Access limited')).toBeInTheDocument();
  });
});
