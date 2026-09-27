import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import PublicJobDetailPage from '@/app/jobs/[slug]/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/sections/public-job-card', () => ({
  PublicJobCard: ({ job }) => <div>{job.title}</div>,
}));

vi.mock('@/components/sections/public-job-apply-action', () => ({
  PublicJobApplyAction: ({ slug }) => <a href={`/jobs/${slug}#apply`}>Apply</a>,
}));

vi.mock('@/components/sections/candidate-job-view-tracker', () => ({
  CandidateJobViewTracker: () => null,
}));

vi.mock('@/app/candidate/actions', () => ({
  saveJobAction: vi.fn(),
  unsaveJobAction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ role: 'CANDIDATE' })),
}));

vi.mock('@/lib/api', () => ({
  getPublicJob: vi.fn(async () => ({
    job: {
      id: 'job-1',
      slug: 'senior-java-developer',
      title: 'Senior Java Developer',
      description: 'Build backend platforms for enterprise products.',
      location: 'Bengaluru',
      employmentType: 'FULL_TIME',
      workplaceType: 'HYBRID',
      experienceMin: 7,
      experienceMax: 10,
      salaryMin: 20,
      salaryMax: 35,
      currency: 'INR',
      numberOfOpenings: 1,
      postedAt: '2026-08-05T00:00:00.000Z',
      createdAt: '2026-08-05T00:00:00.000Z',
      skillsRequired: ['Java', 'Spring Boot', 'AWS'],
      responsibilities: ['Build backend services'],
      requirements: ['7+ years of Java experience'],
      benefits: ['Health insurance'],
      assumptions: ['Internal AI assumption'],
      missingFields: ['Internal missing field'],
      exclusionaryWordingWarnings: ['Internal warning'],
      interviewFocus: ['Internal interview focus'],
      sourceResultId: 'internal-result-id',
      screeningQuestionSuggestions: ['Unaccepted AI question'],
      organisation: {
        slug: 'northstar-talent-labs',
        name: 'Northstar Talent Labs',
        publicDescription: 'Northstar builds specialist hiring teams.',
        benefitsSummary: 'Public company benefits summary.',
        providerMetadata: { traceId: 'internal-provider-trace' },
      },
      saved: false,
    },
    similarJobs: [
      { id: 'job-2', title: 'Platform Engineer' },
    ],
  })),
  getPublicJobApplyContext: vi.fn(async () => ({
    eligibility: { reasonCode: null },
  })),
}));

describe('PublicJobDetailPage', () => {
  test('renders the candidate-facing job detail hierarchy with company linkage', async () => {
    const { container } = render(await PublicJobDetailPage({ params: Promise.resolve({ slug: 'senior-java-developer' }) }));

    expect(screen.getByRole('heading', { name: 'Senior Java Developer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Northstar Talent Labs' })).toHaveAttribute('href', '/companies/northstar-talent-labs');
    expect(screen.getByRole('heading', { name: 'Job Highlights' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Responsibilities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Desired Candidate Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About Company' })).toBeInTheDocument();
    expect(screen.getByText(/Health insurance/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View company page' })).toHaveAttribute('href', '/companies/northstar-talent-labs');
    expect(screen.getAllByText('Platform Engineer').length).toBeGreaterThan(0);
    expect(container).not.toHaveTextContent('Internal AI assumption');
    expect(container).not.toHaveTextContent('Internal missing field');
    expect(container).not.toHaveTextContent('Internal warning');
    expect(container).not.toHaveTextContent('Internal interview focus');
    expect(container).not.toHaveTextContent('internal-result-id');
    expect(container).not.toHaveTextContent('Unaccepted AI question');

    const structuredData = JSON.parse(container.querySelector('script[type="application/ld+json"]').textContent);
    expect(structuredData.description).toBe('Build backend platforms for enterprise products.');
    expect(JSON.stringify(structuredData)).not.toContain('Internal');
    expect(JSON.stringify(structuredData)).not.toContain('internal-result-id');
    expect(JSON.stringify(structuredData)).not.toContain('provider');
  });
});
