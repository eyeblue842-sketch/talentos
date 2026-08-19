import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import CandidateDashboardPage from './page';

const getCandidateDashboardMock = vi.fn();

vi.mock('@/lib/api', () => ({
  getCandidateDashboard: (...args) => getCandidateDashboardMock(...args),
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children }) => <div data-testid="workspace-shell">{children}</div>,
}));

vi.mock('@/components/sections/candidate-profile-snapshot', () => ({
  CandidateProfileSnapshot: ({ snapshot }) => (
    <section aria-label="Candidate profile summary">{snapshot.fullName}</section>
  ),
}));

vi.mock('@/components/sections/candidate-resume-suggestion-banner', () => ({
  CandidateResumeSuggestionBanner: () => <div data-testid="resume-suggestion-banner" />,
}));

vi.mock('@/app/candidate/actions', () => ({
  clearRecentJobsAction: vi.fn(),
}));

function buildDashboard(overrides = {}) {
  return {
    snapshot: {
      fullName: 'Jane Candidate',
      completionPercentage: 41,
    },
    completion: {
      percentage: 41,
      recommendedNextAction: 'Complete education',
      updatedAt: '2026-08-05T09:00:00.000Z',
      missingSections: ['Education'],
    },
    metrics: {
      activeApplicationsCount: 2,
      interviewApplicationsCount: 1,
      closedApplicationsCount: 0,
      withdrawnApplicationsCount: 0,
      unreadNotificationsCount: 3,
      savedJobsCount: 4,
    },
    quickActions: [
      { href: '/candidate/profile', label: 'Update profile' },
    ],
    resumeSuggestions: { hasSuggestions: false, items: [] },
    resumeStatus: {
      hasResume: true,
      primaryResume: { filename: 'jane-resume.pdf' },
      parsingStatusLabel: 'Parsed successfully',
      parsingStatusMessage: 'Ready',
    },
    activeOffers: [],
    recentUpdates: [],
    upcomingInterviews: [],
    recentJobs: [],
    savedJobs: [],
    recommendations: {
      recommendedJobs: [],
      prompt: 'Recommendations will appear later.',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCandidateDashboardMock.mockResolvedValue(buildDashboard());
});

describe('CandidateDashboardPage', () => {
  test('keeps the profile snapshot, removes standalone stat cards, and renders the notifications bell', async () => {
    const { container } = render(await CandidateDashboardPage());

    expect(screen.getByRole('heading', { name: 'Candidate dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /candidate profile summary/i })).toBeInTheDocument();
    expect(screen.queryByText('Profile completion')).not.toBeInTheDocument();
    expect(screen.queryByText('Active applications')).not.toBeInTheDocument();
    expect(screen.queryByText('Unread notifications')).not.toBeInTheDocument();
    expect(screen.queryByText(/active area/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/quick links/i)).not.toBeInTheDocument();

    const bell = screen.getByRole('link', { name: 'Notifications, 3 unread' });
    expect(bell).toHaveAttribute('href', '/candidate/notifications');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(container.querySelector('[class*="md:grid-cols-3"]')).not.toBeInTheDocument();
  });

  test('hides the badge when unread notifications are zero', async () => {
    getCandidateDashboardMock.mockResolvedValueOnce(buildDashboard({
      metrics: {
        ...buildDashboard().metrics,
        unreadNotificationsCount: 0,
      },
    }));

    render(await CandidateDashboardPage());

    const bell = screen.getByRole('link', { name: 'Notifications' });
    expect(bell).toHaveAttribute('href', '/candidate/notifications');
    expect(within(bell).queryByText(/\d+/)).not.toBeInTheDocument();
  });

  test('caps the unread notification badge at 99 plus', async () => {
    getCandidateDashboardMock.mockResolvedValueOnce(buildDashboard({
      metrics: {
        ...buildDashboard().metrics,
        unreadNotificationsCount: 120,
      },
    }));

    render(await CandidateDashboardPage());

    expect(screen.getByRole('link', { name: 'Notifications, 120 unread' })).toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
