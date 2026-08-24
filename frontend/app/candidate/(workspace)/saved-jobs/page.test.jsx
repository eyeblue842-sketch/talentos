import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CandidateSavedJobsPage from './page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/candidate/saved-jobs'),
  useRouter: vi.fn(() => ({ replace: vi.fn(), refresh: vi.fn() })),
  redirect: vi.fn(),
}));

const getCandidateSavedJobsMock = vi.fn(async () => ({
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 },
}));

vi.mock('@/lib/api', () => ({
  getCandidateSavedJobs: (...args) => getCandidateSavedJobsMock(...args),
}));

vi.mock('@/app/candidate/actions', () => ({
  unsaveJobAction: vi.fn(),
}));

describe('CandidateSavedJobsPage - normalized to enter through the shared application shell', () => {
  test('renders through the real CareerizAppShell (not a stub), showing candidate navigation alongside page content', async () => {
    render(await CandidateSavedJobsPage({ searchParams: Promise.resolve({}) }));

    // Shell chrome: role-aware candidate navigation is present.
    expect(screen.getAllByText('Careeriz').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Find Jobs' })).toHaveAttribute('href', '/candidate/jobs');
    expect(screen.getByRole('link', { name: 'Applications' })).toHaveAttribute('href', '/candidate/applications');

    // Business content is unchanged.
    expect(screen.getByRole('heading', { name: 'No saved jobs yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toHaveAttribute('href', '/candidate/jobs');
  });
});
