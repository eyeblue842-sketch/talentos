import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import RecruiterJobResponsesPage from '@/app/recruiter/job-responses/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/lib/api', () => ({
  getCurrentOrganisation: vi.fn(async () => ({
    name: 'Northstar Talent Labs',
    slug: 'northstar-talent-labs',
  })),
  getOrganisationMembers: vi.fn(async () => ([
    { id: 'member-1', role: 'RECRUITER', userId: 'user-1', user: { email: 'recruiter@northstar.example' } },
  ])),
  getRecruiterJobsPage: vi.fn(async () => ({
    items: [
      {
        id: 'job-1',
        title: 'Senior Java Developer',
        status: 'OPEN',
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        experienceMin: 7,
        experienceMax: 10,
        createdAt: '2026-08-05T00:00:00.000Z',
        applicationsCount: 32,
        recruiter: { email: 'recruiter@northstar.example' },
      },
    ],
    meta: { total: 1, page: 1, pageSize: 10, pageCount: 1 },
  })),
  getRecruiterApplicationsV2: vi.fn(async () => ({
    items: [
      {
        id: 'application-1',
        candidate: { fullName: 'Aditi Garg' },
        job: { title: 'Senior Java Developer' },
        stage: 'SHORTLISTED',
        status: 'Under Review',
        flagCount: 1,
        submittedAt: '2026-08-06T00:00:00.000Z',
        source: { sourceType: 'CAREER_PAGE', sourceName: 'Careeriz' },
      },
    ],
    meta: { total: 1, page: 1, pageSize: 50, pageCount: 1 },
  })),
}));

describe('RecruiterJobResponsesPage', () => {
  test('renders job rows and candidate responses from existing job/application records', async () => {
    render(await RecruiterJobResponsesPage({ searchParams: Promise.resolve({ jobId: 'job-1' }) }));

    expect(screen.getByRole('heading', { name: 'Job Responses' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Post Job' })).toHaveAttribute('href', '/recruiter/jobs');
    expect(screen.getAllByText('Senior Java Developer').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'View Responses' })).toHaveAttribute('href', '/recruiter/job-responses?jobId=job-1');
    expect(screen.getByText('Aditi Garg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Move to Pipeline' })).toHaveAttribute('href', '/recruiter/ats/application-1');
  });
});
