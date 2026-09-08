import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import InvitationAcceptPage from './page.jsx';

const getInvitationTokenDetail = vi.fn();
const getCurrentUser = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect() should not be called in these tests');
  }),
}));

vi.mock('@/lib/api', () => ({
  getInvitationTokenDetail: (...args) => getInvitationTokenDetail(...args),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args) => getCurrentUser(...args),
}));

vi.mock('../actions', () => ({
  acceptOrganisationInvitationAction: vi.fn(),
}));

describe('InvitationAcceptPage', () => {
  beforeEach(() => {
    getInvitationTokenDetail.mockReset();
    getCurrentUser.mockReset().mockResolvedValue(null);
  });

  test('a missing token shows a distinct "Invitation missing" message without calling the backend', async () => {
    const element = await InvitationAcceptPage({ searchParams: Promise.resolve({}) });
    render(element);

    expect(screen.getByText('Invitation missing')).toBeInTheDocument();
    expect(screen.getByText('A valid invitation token is required.')).toBeInTheDocument();
    expect(getInvitationTokenDetail).not.toHaveBeenCalled();
  });

  test('a valid token for an unauthenticated visitor reads the canonical "token" param and round-trips it through the employer entry "next"', async () => {
    getInvitationTokenDetail.mockResolvedValue({
      organisation: { name: 'Acme' },
      role: 'RECRUITER',
      expiresAt: new Date('2026-09-15T00:00:00Z').toISOString(),
    });

    const element = await InvitationAcceptPage({ searchParams: Promise.resolve({ token: 'abc123' }) });
    render(element);

    expect(getInvitationTokenDetail).toHaveBeenCalledWith('abc123');
    expect(screen.getByText('Acme')).toBeInTheDocument();

    const signInLink = screen.getByRole('link', { name: 'Employer Sign In' });
    const href = signInLink.getAttribute('href');
    expect(href).toContain('/hire?');
    const next = new URL(href, 'http://localhost').searchParams.get('next');
    expect(next).toBe('/auth/invitations/accept?token=abc123');
  });

  test('an invalid/expired/revoked token surfaces the backend\'s distinct safe message, never the raw token', async () => {
    getInvitationTokenDetail.mockRejectedValue(Object.assign(new Error('This invitation has expired.'), { statusCode: 410 }));

    const element = await InvitationAcceptPage({ searchParams: Promise.resolve({ token: 'expired-raw-token-value' }) });
    render(element);

    expect(screen.getByText('Invitation unavailable')).toBeInTheDocument();
    expect(screen.getByText('This invitation has expired.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('expired-raw-token-value');
  });
});
