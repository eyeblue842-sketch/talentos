import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import CandidateDashboardPage from '@/app/candidate/(workspace)/dashboard/page';
import CandidateNotificationsPage from '@/app/candidate/(workspace)/notifications/page';
import CandidateSavedJobsPage from '@/app/candidate/(workspace)/saved-jobs/page';
import { CandidateApplicationDetailView } from '../candidate-application-detail-view';
import { CandidateApplicationWithdrawForm } from '../candidate-application-withdraw-form';
import { CandidateSettingsForm } from '../candidate-settings-form';
import { ApplicationsList } from '../applications-list';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/candidate/dashboard'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
}));

vi.mock('@/app/candidate/actions', () => ({
  clearRecentJobsAction: vi.fn(async () => {}),
  markAllNotificationsReadAction: vi.fn(async () => {}),
  markNotificationReadAction: vi.fn(async () => {}),
  submitCandidateSettingsFormAction: vi.fn(async () => ({ status: 'success', message: 'Saved', fieldErrors: {} })),
  unsaveJobAction: vi.fn(async () => {}),
  withdrawCandidateApplicationAction: vi.fn(async () => ({ status: 'success', message: 'Withdrawn', fieldErrors: {} })),
}));

vi.mock('@/lib/api', () => ({
  getCandidateDashboard: vi.fn(),
  getCandidateNotifications: vi.fn(),
  getCandidateSavedJobs: vi.fn(),
}));

const { getCandidateDashboard, getCandidateNotifications, getCandidateSavedJobs } = await import('@/lib/api');

function buildDashboard() {
  return {
    completion: {
      percentage: 80,
      updatedAt: '2026-07-17T09:00:00.000Z',
      missingSections: ['Professional summary'],
      recommendedNextAction: 'Complete professional summary.',
    },
    metrics: {
      activeApplicationsCount: 2,
      interviewApplicationsCount: 1,
      unreadNotificationsCount: 1,
      savedJobsCount: 2,
      closedApplicationsCount: 0,
      withdrawnApplicationsCount: 0,
    },
    quickActions: [
      { label: 'Browse Jobs', href: '/candidate/jobs' },
      { label: 'Manage Preferences', href: '/candidate/settings' },
    ],
    recentUpdates: [
      { id: 'notification-1', title: 'Application received', message: 'Your application is under review.', createdAt: '2026-07-17T10:00:00.000Z', link: '/candidate/applications/application-1' },
    ],
    recentJobs: [
      { id: 'view-1', viewedAt: '2026-07-17T08:00:00.000Z', job: { slug: 'frontend-engineer', title: 'Frontend Engineer', location: 'Bengaluru', organisation: { name: 'Acme Labs' } } },
    ],
    savedJobs: [
      { id: 'saved-1', snapshot: { title: 'Frontend Engineer', organisationName: 'Acme Labs' }, job: { slug: 'frontend-engineer', title: 'Frontend Engineer', organisation: { name: 'Acme Labs' } } },
    ],
    recommendations: {
      prompt: null,
      recommendedJobs: [
        { id: 'job-2', slug: 'backend-engineer', title: 'Backend Engineer', location: 'Remote', reasons: ['Matches your skills'], organisation: { name: 'Acme Labs' } },
      ],
    },
  };
}

function buildNotifications() {
  return {
    items: [
      {
        id: 'notification-1',
        title: 'Application received',
        message: 'Your application is under review.',
        createdAt: '2026-07-17T10:00:00.000Z',
        isUnread: true,
        link: '/candidate/applications/application-1',
      },
    ],
    meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
  };
}

function buildSavedJobs() {
  return {
    items: [
      {
        id: 'saved-1',
        snapshot: { title: 'Frontend Engineer', organisationName: 'Acme Labs' },
        job: {
          slug: 'frontend-engineer',
          title: 'Frontend Engineer',
          description: 'Build candidate-facing product experiences.',
          skillsRequired: ['React', 'Next.js', 'Accessibility'],
          location: 'Bengaluru',
          organisation: { name: 'Acme Labs' },
          saved: true,
          status: 'OPEN',
          employmentType: 'FULL_TIME',
          workplaceType: 'HYBRID',
        },
      },
    ],
    meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
  };
}

function buildApplication() {
  return {
    id: 'application-1',
    publicReference: 'APP-42',
    submittedAt: '2026-07-17T09:15:00.000Z',
    status: 'Interview Stage',
    stage: 'INTERVIEW_SCHEDULED',
    canWithdraw: true,
    source: {
      sourceType: 'CAREER_PAGE',
      sourceName: 'Career page',
    },
    screeningSummary: {
      answeredQuestions: 1,
    },
    job: {
      title: 'Frontend Engineer',
      slug: 'frontend-engineer',
      location: 'Bengaluru',
      organisation: {
        name: 'Acme Labs',
      },
    },
    resume: {
      filename: 'resume.pdf',
    },
    answers: [{
      id: 'answer-1',
      questionText: 'Years of React experience',
      internalLabel: 'React experience',
      questionType: 'NUMBER',
      required: true,
      answerValue: 6,
    }],
    timeline: [{
      id: 'timeline-1',
      eventType: 'INTERVIEW_SCHEDULED',
      message: 'Interview scheduled for July 20.',
      createdAt: '2026-07-18T10:00:00.000Z',
    }],
  };
}

function buildSettings() {
  return {
    profileVisibility: 'PRIVATE',
    recommendationEnabled: true,
    preferredRoles: ['frontend engineer'],
    preferredIndustries: ['Software'],
    preferredCompanySizes: ['51-200'],
    preferredLocations: ['Bengaluru', 'Remote'],
    willingToRelocate: true,
    workplacePreferences: ['HYBRID', 'REMOTE'],
    employmentPreferences: ['FULL_TIME'],
    minExpectedSalary: 2200000,
    preferredCurrency: 'INR',
    availability: 'IMMEDIATE',
    noticePeriodDays: 30,
    workAuthorization: 'India',
    requiresVisaSponsorship: false,
    travelWillingness: 'Occasional',
    jobAlertEnabled: true,
    jobAlertFrequency: 'WEEKLY',
    notifyForSavedJobUpdates: true,
    notifyForApplicationUpdates: true,
    notifyForRecommendations: true,
    notifyForInterviews: true,
    notifyForOffers: true,
    notifyForProfileReminders: true,
    notifyForMarketing: false,
  };
}

beforeEach(() => {
  getCandidateDashboard.mockResolvedValue(buildDashboard());
  getCandidateNotifications.mockResolvedValue(buildNotifications());
  getCandidateSavedJobs.mockResolvedValue(buildSavedJobs());
});

describe('Candidate Experience Accessibility', () => {
  test('candidate dashboard has no obvious accessibility violations', async () => {
    const { container } = render(await CandidateDashboardPage());
    expect((await axe(container)).violations).toHaveLength(0);
  });

  test('candidate notifications has no obvious accessibility violations', async () => {
    const { container } = render(await CandidateNotificationsPage({ searchParams: Promise.resolve({}) }));
    expect((await axe(container)).violations).toHaveLength(0);
  });

  test('candidate saved jobs has no obvious accessibility violations', async () => {
    const { container } = render(await CandidateSavedJobsPage({ searchParams: Promise.resolve({}) }));
    expect((await axe(container)).violations).toHaveLength(0);
  });

  test('candidate application tracking views have no obvious accessibility violations', async () => {
    const detail = render(<CandidateApplicationDetailView application={buildApplication()} />);
    expect((await axe(detail.container)).violations).toHaveLength(0);

    const list = render(
      <ApplicationsList
        applications={[{
          id: 'application-1',
          role: 'Frontend Engineer',
          company: 'Acme Labs',
          location: 'Bengaluru',
          summary: 'Reference APP-42',
          latestUpdate: 'Interview scheduled for Monday.',
          reference: 'APP-42',
          href: '/candidate/applications/application-1',
          tone: 'brand',
          status: 'Interview stage',
          stage: 'INTERVIEW_STAGE',
          date: '7/17/2026',
        }]}
      />,
    );
    expect((await axe(list.container)).violations).toHaveLength(0);
  });

  test('candidate withdrawal and preferences forms have no obvious accessibility violations', async () => {
    const withdraw = render(<CandidateApplicationWithdrawForm applicationId="application-1" canWithdraw />);
    expect((await axe(withdraw.container)).violations).toHaveLength(0);

    const settings = render(<CandidateSettingsForm settings={buildSettings()} />);
    expect((await axe(settings.container)).violations).toHaveLength(0);
  });
});
