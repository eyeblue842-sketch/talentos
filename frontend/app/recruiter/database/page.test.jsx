import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import RecruiterDatabasePage from '@/app/recruiter/database/page';
import { isResumeSearchV2RolloutEnabledForServer } from '@/lib/resume-search-v2-rollout.server';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/lib/api', () => ({
  getCurrentOrganisation: vi.fn(async () => ({ id: 'org-1', name: 'Northstar Talent Labs', slug: 'northstar' })),
  getRecruiterJobs: vi.fn(async () => []),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', role: 'RECRUITER', activeMembership: { organisationId: 'org-1', role: 'RECRUITER', permissions: ['intelligence.search.read', 'intelligence.search.execute'] } })),
}));

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn((key) => key === 'semanticSearch' || key === 'resumeSearchV2'),
}));

vi.mock('@/lib/resume-search-v2-rollout.server', () => ({
  isResumeSearchV2RolloutEnabledForServer: vi.fn(() => false),
}));

vi.mock('@/components/sections/recruiter-resume-search-page', () => ({
  RecruiterResumeSearchPage: () => <div data-testid="legacy-search">Legacy search</div>,
}));

vi.mock('@/components/sections/recruiter-resume-search-v2-page', () => ({
  RecruiterResumeSearchV2Page: () => <div data-testid="v2-search">V2 search</div>,
}));

describe('RecruiterDatabasePage', () => {
  test('keeps the legacy search experience when V2 rollout is disabled', async () => {
    render(await RecruiterDatabasePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('legacy-search')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-search')).not.toBeInTheDocument();
  });

  test('renders the V2 experience only when the server-side rollout allows it', async () => {
    isResumeSearchV2RolloutEnabledForServer.mockReturnValue(true);
    render(await RecruiterDatabasePage({ searchParams: Promise.resolve({ kw: ['MUST:IT'] }) }));
    expect(screen.getByTestId('v2-search')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-search')).not.toBeInTheDocument();
  });
});
