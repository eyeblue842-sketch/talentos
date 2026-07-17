import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, test, vi } from 'vitest';
import { RecruiterApplicationDetailView } from '../recruiter-application-detail-view';

function buildActions() {
  return {
    addNoteAction: vi.fn(async () => {}),
    cancelInterviewAction: vi.fn(async () => {}),
    deleteNoteAction: vi.fn(async () => {}),
    editNoteAction: vi.fn(async () => {}),
    moveApplicationStageAction: vi.fn(async () => {}),
    scheduleInterviewAction: vi.fn(async () => {}),
  };
}

function buildApplication(overrides = {}) {
  return {
    id: 'job-application-1',
    applicationId: 'legacy-application-1',
    submittedAt: '2026-07-17T09:00:00.000Z',
    publicReference: 'APP-92A1',
    stage: 'APPLIED',
    job: { title: 'Frontend Engineer' },
    source: { sourceName: 'Career Page', sourceType: 'CAREER_PAGE' },
    screeningSummary: { flags: 1, totalQuestions: 2 },
    candidate: {
      fullName: 'Aarav Sharma',
      headline: 'Frontend Engineer',
      skills: ['React', 'TypeScript'],
      totalExperience: 6,
      location: 'Bengaluru',
      availability: '30 days',
      email: 'aarav@example.com',
      resumeDownloadUrl: '/api/resumes/candidate/candidate-1/download',
    },
    resume: {
      downloadUrl: '/api/ats/applications/job-application-1/resume',
    },
    answers: [
      {
        id: 'answer-1',
        questionText: 'Years of React experience',
        questionType: 'NUMBER',
        required: true,
        answerValue: 6,
        file: null,
        screeningOutcome: 'MEETS_CRITERIA',
      },
    ],
    flags: [
      {
        id: 'flag-1',
        outcome: 'REVIEW_REQUIRED',
        internalReason: 'Manual review requested.',
      },
    ],
    notes: [
      {
        id: 'note-1',
        content: 'Strong portfolio.',
        createdAt: '2026-07-17T09:10:00.000Z',
        author: { email: 'recruiter@example.com' },
      },
    ],
    activities: [
      {
        id: 'activity-1',
        eventType: 'NOTE_ADDED',
        message: 'Recruiter note added.',
        createdAt: '2026-07-17T09:11:00.000Z',
        actor: { email: 'recruiter@example.com' },
      },
    ],
    interviewProcesses: [
      {
        id: 'process-1',
        rounds: [
          {
            id: 'round-1',
            roundName: 'Technical Round',
            interviewType: 'TECHNICAL',
            status: 'SCHEDULED',
            scheduledStartAt: '2026-07-18T09:00:00.000Z',
            feedbacks: [{ id: 'feedback-1' }],
          },
        ],
      },
    ],
    timeline: [
      {
        id: 'timeline-1',
        eventType: 'APPLICATION_SUBMITTED',
        message: 'Application submitted.',
        createdAt: '2026-07-17T09:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('RecruiterApplicationDetailView', () => {
  test('renders legacy ATS sections alongside screening answers and flags', () => {
    render(<RecruiterApplicationDetailView application={buildApplication()} members={[{ userId: 'user-1' }]} actions={buildActions()} />);

    expect(screen.getByRole('heading', { name: 'Candidate and job summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interview scheduling' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recruiter notes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activity timeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Screening answers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Screening flags and summary' })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Strong portfolio.')).toHaveLength(1);
    expect(screen.getByText('Manual review requested.')).toBeInTheDocument();
    expect(screen.getAllByText('Technical Round').length).toBeGreaterThan(0);
  });

  test('renders safe empty states when notes, activity, interviews, answers, or flags are missing', () => {
    render(<RecruiterApplicationDetailView application={buildApplication({
      answers: [],
      flags: [],
      notes: [],
      activities: [],
      interviewProcesses: [],
      timeline: [],
      resume: null,
      candidate: {
        ...buildApplication().candidate,
        resumeDownloadUrl: null,
      },
    })} members={[]} actions={buildActions()} />);

    expect(screen.getByText('No submitted resume snapshot')).toBeInTheDocument();
    expect(screen.getByText('No candidate resume on file')).toBeInTheDocument();
    expect(screen.getByText('No screening answers were submitted.')).toBeInTheDocument();
    expect(screen.getByText('No screening flags were generated.')).toBeInTheDocument();
    expect(screen.getByText('No recruiter notes yet.')).toBeInTheDocument();
    expect(screen.getByText('No recruiter activity yet.')).toBeInTheDocument();
    expect(screen.getByText('No interview rounds are linked to this application yet.')).toBeInTheDocument();
    expect(screen.getByText('No submission timeline items available.')).toBeInTheDocument();
  });

  test('has no obvious accessibility violations', async () => {
    const { container } = render(<RecruiterApplicationDetailView application={buildApplication()} members={[{ userId: 'user-1' }]} actions={buildActions()} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
