import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import RecruiterDatabaseResultsPage from '@/app/recruiter/database/results/page';
import { isResumeSearchV2RolloutEnabledForServer } from '@/lib/resume-search-v2-rollout.server';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }) => <div>{title}</div>,
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

vi.mock('@/components/sections/recruiter-semantic-search-workspace', () => ({
  RecruiterSemanticSearchWorkspace: () => <div data-testid="legacy-results">Legacy results</div>,
}));

vi.mock('@/components/sections/recruiter-resume-search-v2-page', () => ({
  RecruiterResumeSearchV2Page: () => <div data-testid="v2-results">V2 results</div>,
}));

describe('RecruiterDatabaseResultsPage', () => {
  test('direct results route access still falls back safely when V2 rollout is disabled', async () => {
    render(await RecruiterDatabaseResultsPage({ searchParams: Promise.resolve({ kw: ['MUST:IT'] }) }));
    expect(screen.getByTestId('legacy-results')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-results')).not.toBeInTheDocument();
  });

  test('direct results route access shows V2 only when the server-side rollout allows it', async () => {
    isResumeSearchV2RolloutEnabledForServer.mockReturnValue(true);
    render(await RecruiterDatabaseResultsPage({ searchParams: Promise.resolve({ kw: ['MUST:IT'] }) }));
    expect(screen.getByTestId('v2-results')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-results')).not.toBeInTheDocument();
  });
});
