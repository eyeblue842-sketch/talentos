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
  getRecruiterJobs: vi.fn(async () => ([
    {
      id: 'job-1',
      title: 'Senior Java Developer',
      status: 'OPEN',
      location: 'Bengaluru',
      skillsRequired: ['Java'],
    },
  ])),
  getOrganisationMembers: vi.fn(async () => ([
    { id: 'member-1', role: 'RECRUITER', userId: 'user-1', user: { email: 'recruiter@northstar.example' } },
  ])),
  getApprovedRequisitions: vi.fn(async () => ([
    { id: 'req-1', requisitionCode: 'REQ-1001', title: 'Senior Java Developer' },
  ])),
}));

describe('RecruiterJobsPage', () => {
  test('renders the staged job posting wizard with prefill-from-previous and no manage-jobs list', async () => {
    render(await RecruiterJobsPage());

    expect(screen.getByRole('heading', { name: 'Post a job' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Job details$/i })).toBeInTheDocument();
    ['Job details', 'Candidate requirements', 'Job description', 'Screening questions', 'Preview & publish'].forEach((label, index) => {
      expect(screen.getAllByRole('button').some((button) => button.textContent?.includes(label) && button.textContent?.includes(`Stage ${index + 1}`))).toBe(true);
    });
    expect(screen.getByRole('button', { name: /Prefill from a previous job/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Manage Jobs' })).not.toBeInTheDocument();
  });
});
