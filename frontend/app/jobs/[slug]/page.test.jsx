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
      organisation: {
        slug: 'northstar-talent-labs',
        name: 'Northstar Talent Labs',
        publicDescription: 'Northstar builds specialist hiring teams.',
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
    render(await PublicJobDetailPage({ params: Promise.resolve({ slug: 'senior-java-developer' }) }));

    expect(screen.getByRole('heading', { name: 'Senior Java Developer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Northstar Talent Labs' })).toHaveAttribute('href', '/companies/northstar-talent-labs');
    expect(screen.getByRole('heading', { name: 'Job Highlights' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Responsibilities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Desired Candidate Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About Company' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View company page' })).toHaveAttribute('href', '/companies/northstar-talent-labs');
    expect(screen.getAllByText('Platform Engineer').length).toBeGreaterThan(0);
  });
});
