import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, test, vi } from 'vitest';
import CandidateDashboardLoading from '@/app/candidate/(workspace)/dashboard/loading';
import RecruiterHomeLoading from '@/app/recruiter/home/loading';
import AdminLoading from '@/app/admin/loading';
import RecruiterResumeSearchResultsLoading from '@/app/recruiter/database/results/loading';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ replace: vi.fn(), refresh: vi.fn() })),
}));

// Every dashboard route now shows a loading skeleton (previously none
// existed anywhere in the app) wrapped in the real shell with its real,
// static, role-appropriate nav items - not a blank screen, and not
// re-deriving permissions or fetching anything.
describe('dashboard loading states', () => {
  test('candidate dashboard loading renders the real candidate shell with skeleton content, no fake data', async () => {
    const { container } = render(<CandidateDashboardLoading />);
    expect(screen.getByRole('link', { name: 'Find Jobs' })).toHaveAttribute('href', '/candidate/jobs');
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });

  test('recruiter home loading renders the real recruiter shell with skeleton content', async () => {
    const { container } = render(<RecruiterHomeLoading />);
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('href', '/recruiter/members');
    expect((await axe(container)).violations).toHaveLength(0);
  });

  test('admin overview loading renders the real admin shell with skeleton content', async () => {
    const { container } = render(<AdminLoading />);
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    expect((await axe(container)).violations).toHaveLength(0);
  });

  test('resume search results loading renders the real recruiter shell with a three-column skeleton', async () => {
    const { container } = render(<RecruiterResumeSearchResultsLoading />);
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/recruiter/billing');
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
