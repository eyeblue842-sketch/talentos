import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import RecruiterJobsPage from '@/app/recruiter/jobs/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/app/recruiter/actions', () => ({
  createJobAction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ email: 'owner@northstar.example' })),
}));

vi.mock('@/lib/api', () => ({
  getCurrentOrganisation: vi.fn(async () => ({
    name: 'Northstar Talent Labs',
    slug: 'northstar-talent-labs',
    publicDescription: 'Hiring partner for growth-stage product teams.',
  })),
  getRecruiterJobsPage: vi.fn(async () => ({
    items: [
      {
        id: 'job-1',
        title: 'Senior Java Developer',
        status: 'OPEN',
        location: 'Bengaluru',
        skillsRequired: ['Java'],
      },
    ],
    meta: { total: 1, page: 1, pageSize: 10, pageCount: 1 },
  })),
  getOrganisationMembers: vi.fn(async () => ([
    { id: 'member-1', role: 'RECRUITER', userId: 'user-1', user: { email: 'recruiter@northstar.example' } },
  ])),
  getApprovedRequisitions: vi.fn(async () => ([
    { id: 'req-1', requisitionCode: 'REQ-1001', title: 'Senior Java Developer' },
  ])),
}));

vi.mock('@/components/sections/jobs-table', () => ({
  JobsTable: ({ jobs }) => <div data-testid="jobs-table">{jobs.map((job) => job.title).join(', ')}</div>,
}));

describe('RecruiterJobsPage', () => {
  test('renders the recruiter job posting wizard and existing jobs list', async () => {
    render(await RecruiterJobsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'Job Posts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Job Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Candidate Preferences/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Screening Questions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Communication Preferences/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Manage Jobs' })).toBeInTheDocument();
    expect(screen.getByTestId('jobs-table')).toHaveTextContent('Senior Java Developer');
  });
});
