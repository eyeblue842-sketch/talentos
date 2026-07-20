import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CandidateApplicationDetailView } from '../candidate-application-detail-view';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

function createApplication(overrides = {}) {
  return {
    id: 'application-1',
    publicReference: 'APP-42',
    submittedAt: '2026-07-17T09:15:00.000Z',
    status: 'Interview scheduled',
    stage: 'INTERVIEW_SCHEDULED',
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
    ...overrides,
  };
}

describe('CandidateApplicationDetailView', () => {
  test('renders stage progress, timeline, and screening answers', () => {
    render(<CandidateApplicationDetailView application={createApplication()} />);

    expect(screen.getByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument();
    expect(screen.getByText(/Ref APP-42/)).toBeInTheDocument();
    expect(screen.getAllByText('INTERVIEW SCHEDULED').length).toBeGreaterThan(0);
    expect(screen.getByText('Interview scheduled for July 20.')).toBeInTheDocument();
    expect(screen.getByText('React experience')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View job' })).toHaveAttribute('href', '/jobs/frontend-engineer');
  });

  test('renders empty states when no timeline or answers exist', () => {
    render(<CandidateApplicationDetailView application={createApplication({ answers: [], timeline: [] })} />);

    expect(screen.getByText('No candidate-visible updates have been added yet.')).toBeInTheDocument();
    expect(screen.getByText('No screening responses were captured.')).toBeInTheDocument();
  });
});
