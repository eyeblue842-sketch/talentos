import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CandidateProfileSnapshot, CandidateResumeSummaryCard } from '../candidate-profile-snapshot';
import { formatCareerizDate } from '@/lib/date-format';

function buildSnapshot(overrides = {}) {
  return {
    completionPercentage: 64,
    profileImageUrl: null,
    fullName: 'Vinoj Pillai',
    headline: 'Strategic HR Leader',
    currentTitle: 'HR Manager',
    currentEmployer: 'TechAffinity Consulting Pvt Ltd',
    currentDesignation: 'HR Manager',
    location: 'Bengaluru, INDIA',
    totalExperience: 17,
    currentCtcLpa: 20,
    phoneNumber: '9061190007',
    email: 'vinoj@example.com',
    noticePeriodDays: 30,
    availability: 'ONE_MONTH',
    updatedAt: '2026-08-05T09:00:00.000Z',
    resumeStatus: {
      filename: 'vinoj-pillai-resume.pdf',
      parsingStatusLabel: 'Parsed successfully',
      parsingStatusMessage: 'Resume details are available to review and apply to your profile.',
      uploadedAt: '2026-08-05T08:00:00.000Z',
      updatedAt: '2026-08-05T09:00:00.000Z',
      hasResume: true,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-05T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CandidateProfileSnapshot', () => {
  test('renders the wide snapshot card with candidate identity, compensation, and contact details', () => {
    render(<CandidateProfileSnapshot snapshot={buildSnapshot()} onEdit={() => {}} />);

    const region = screen.getByRole('region', { name: /candidate profile summary/i });
    expect(region).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /candidate profile summary/i })).toHaveLength(1);
    expect(within(region).getByRole('heading', { name: 'Vinoj Pillai' })).toBeInTheDocument();
    expect(within(region).getByText('HR Manager')).toBeInTheDocument();
    expect(within(region).getByText(/at TechAffinity Consulting Pvt Ltd/i)).toBeInTheDocument();
    expect(within(region).getByText('Bengaluru, INDIA')).toBeInTheDocument();
    expect(within(region).getByText('17 Years')).toBeInTheDocument();
    expect(within(region).getByText('₹20 lakh per annum')).toBeInTheDocument();
    expect(within(region).getByText('9061190007')).toBeInTheDocument();
    expect(within(region).getByText('vinoj@example.com')).toBeInTheDocument();
    expect(within(region).getByText('1 Month notice period')).toBeInTheDocument();
    expect(within(region).getByText('64%')).toBeInTheDocument();
    expect(within(region).getByText('Today')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: /edit profile snapshot/i })).toBeInTheDocument();
    expect(within(region).queryByText(/profile snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resume summary/i)).not.toBeInTheDocument();
  });

  test('clicking the pencil calls the explicit edit handler instead of navigating to a hash', () => {
    const onEdit = vi.fn();
    render(<CandidateProfileSnapshot snapshot={buildSnapshot()} onEdit={onEdit} />);

    screen.getByRole('button', { name: /edit profile snapshot/i }).click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: /edit profile snapshot/i })).not.toBeInTheDocument();
  });

  test('renders a fallback avatar when no profile image exists', () => {
    render(<CandidateProfileSnapshot snapshot={buildSnapshot({ profileImageUrl: null, fullName: 'Career User' })} />);

    expect(screen.getByLabelText(/profile avatar fallback/i)).toHaveTextContent('CU');
  });

  test('renders the uploaded profile photo through the candidate photo endpoint', () => {
    render(<CandidateProfileSnapshot snapshot={buildSnapshot({ profileImageUrl: 'private:local:candidate-profile-photos/2026/08/avatar.jpg' })} />);

    expect(screen.getByAltText('Vinoj Pillai')).toHaveAttribute('src', '/api/candidate/profile-photo?v=2026-08-05T09%3A00%3A00.000Z');
  });

  test('renders not added fallbacks instead of empty snapshot values', () => {
    render(<CandidateProfileSnapshot snapshot={buildSnapshot({
      currentTitle: null,
      currentEmployer: null,
      location: null,
      totalExperience: null,
      currentCtcLpa: null,
      phoneNumber: null,
      email: null,
      noticePeriodDays: null,
    })} />);

    const region = screen.getByRole('region', { name: /candidate profile summary/i });
    expect(within(region).getAllByText('Not added').length).toBeGreaterThan(0);
  });

  test('renders resume summary as a single horizontal card', () => {
    render(<CandidateResumeSummaryCard snapshot={buildSnapshot()} />);

    expect(screen.getByText('Resume')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'vinoj-pillai-resume.pdf' })).toBeInTheDocument();
    expect(screen.getByText('Parsed successfully')).toBeInTheDocument();
    expect(screen.getByText('Uploaded on 5 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('Updated 5 Aug 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Update Resume' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download Resume' })).toBeInTheDocument();
  });

  test('uses deterministic UTC date formatting regardless of runtime locale', () => {
    const localeSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(() => '8/5/2026');

    expect(formatCareerizDate('2026-08-05T09:00:00.000Z')).toBe('5 Aug 2026');

    localeSpy.mockRestore();
  });
});
