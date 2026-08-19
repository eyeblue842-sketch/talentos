import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import PublicOrganisationPage from '@/app/companies/[slug]/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
}));

// This page calls getCurrentUser() (lib/auth.js), which reads next/headers'
// cookies() to resolve the session. Outside a real request scope that
// throws, so it must be mocked the same way lib/__tests__/auth.test.js
// already does. No cookie -> getCurrentUser() resolves to null, matching
// this suite's own intent of rendering as an anonymous/non-recruiter
// visitor ("without recruiter edit actions").
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

vi.mock('@/lib/api', () => ({
  getPublicOrganisation: vi.fn(async () => ({
    organisation: {
      id: 'org-1',
      name: 'Northstar Talent Labs',
      slug: 'northstar-talent-labs',
      website: 'https://northstar.example',
      industry: 'Staffing & Recruiting',
      organisationSize: '11-50',
      headquarters: 'Bengaluru, Karnataka',
      publicDescription: 'Northstar builds specialist hiring teams for growth-stage product companies.',
      publicLocations: ['Bengaluru, Karnataka'],
      cultureSummary: 'High-ownership hiring teams.',
      updatedAt: '2026-08-05T00:00:00.000Z',
      logoUrl: '',
    },
    recentJobs: [
      {
        id: 'job-1',
        slug: 'senior-java-developer',
        title: 'Senior Java Developer',
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        experienceMin: 7,
        experienceMax: 10,
        postedAt: '2026-08-05T00:00:00.000Z',
        skillsRequired: ['Java', 'Spring Boot'],
      },
    ],
    jobs: {
      items: [
        {
          id: 'job-1',
          slug: 'senior-java-developer',
          title: 'Senior Java Developer',
          location: 'Bengaluru',
          employmentType: 'FULL_TIME',
          workplaceType: 'HYBRID',
          experienceMin: 7,
          experienceMax: 10,
          postedAt: '2026-08-05T00:00:00.000Z',
          skillsRequired: ['Java', 'Spring Boot'],
        },
      ],
      meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
    },
    posts: [
      {
        id: 'post-1',
        content: 'We are expanding our product engineering hiring this quarter.',
        createdAt: '2026-08-05T00:00:00.000Z',
        publishedAt: '2026-08-05T00:00:00.000Z',
      },
    ],
    peopleInsights: {
      sampleSize: 12,
      locations: [{ label: 'Bengaluru', count: 6 }],
      education: [{ label: 'Engineering', count: 7 }],
      roles: [{ label: 'Software Engineer', count: 5 }],
      experienceLevels: [{ label: '6-10 years', count: 4 }],
      skills: [{ label: 'Java', count: 6 }],
    },
    publicInsights: {
      activeJobCount: 1,
      hiringLocations: [{ label: 'Bengaluru', count: 1 }],
      commonRoles: [{ label: 'Senior Java Developer', count: 1 }],
      commonSkills: [{ label: 'Java', count: 1 }],
    },
  })),
}));

describe('PublicOrganisationPage', () => {
  test('renders candidate-safe company home without recruiter edit actions or a posts tab', async () => {
    render(await PublicOrganisationPage({
      params: Promise.resolve({ slug: 'northstar-talent-labs' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('heading', { name: 'Northstar Talent Labs' })).toBeInTheDocument();
    expect(screen.getByText('Staffing & Recruiting')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/companies/northstar-talent-labs');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/companies/northstar-talent-labs?tab=about');
    expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '/companies/northstar-talent-labs?tab=jobs');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/companies/northstar-talent-labs?tab=people');
    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute('href', '/companies/northstar-talent-labs?tab=insights');
    expect(screen.queryByText('Posts')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit company profile' })).not.toBeInTheDocument();
    expect(screen.queryByText('Profile updated')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest from Northstar Talent Labs' })).toBeInTheDocument();
    expect(screen.getByText(/We are expanding our product engineering hiring this quarter/i)).toBeInTheDocument();
  });

  test('renders only selected-company jobs on the jobs tab', async () => {
    render(await PublicOrganisationPage({
      params: Promise.resolve({ slug: 'northstar-talent-labs' }),
      searchParams: Promise.resolve({ tab: 'jobs' }),
    }));

    expect(screen.getByRole('heading', { name: 'Open jobs' })).toBeInTheDocument();
    expect(screen.getByText('Senior Java Developer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Job' })).toHaveAttribute('href', '/jobs/senior-java-developer');
  });
});
