import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CandidateInterviewsPage from '@/app/candidate/(workspace)/interviews/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/candidate/interviews'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
}));

vi.mock('@/lib/api', () => ({
  getCandidateInterviews: vi.fn(async () => ({
    upcoming: [
      {
        id: 'round-1',
        roundName: 'Technical Round',
        status: 'SCHEDULED',
        scheduledStartAt: '2030-07-21T10:00:00.000Z',
        timezone: 'Asia/Kolkata',
        meetingMode: 'VIRTUAL',
        meetingProvider: 'GOOGLE_MEET',
        providerDisplayName: 'Google Meet',
        meetingLink: 'https://meet.google.com/example-link',
        calendarDownloadUrl: '/api/interviews/candidate/rounds/round-1/calendar.ics',
        candidateInstructions: 'Join 5 minutes early.',
        dialInInformation: '+91 80 1111 1111',
        rescheduleCount: 1,
        applicationId: 'application-1',
        job: { title: 'Backend Engineer', organisation: { name: 'Acme Labs' } },
        rescheduleRequests: [
          {
            id: 'request-1',
            status: 'PENDING',
            reasonCode: 'SCHEDULE_CONFLICT',
            reasonText: 'Overlap with a client commitment.',
          },
        ],
      },
    ],
    rescheduled: [],
    past: [],
    cancelled: [],
  })),
}));

vi.mock('@/app/candidate/actions', () => ({
  requestInterviewRescheduleAction: vi.fn(async () => {}),
  withdrawInterviewRescheduleAction: vi.fn(async () => {}),
}));

describe('Milestone 8.5 candidate interview center', () => {
  test('renders provider details, calendar download, and reschedule controls', async () => {
    render(await CandidateInterviewsPage());

    expect(screen.getByRole('heading', { name: /track every scheduled interview in one place/i })).toBeInTheDocument();
    expect(screen.getByText(/Provider: Google Meet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download calendar/i })).toHaveAttribute('href', '/api/interviews/candidate/rounds/round-1/calendar.ics');
    expect(screen.getByText(/latest reschedule request: PENDING/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /withdraw request/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request reschedule/i })).toBeInTheDocument();
  });
});
