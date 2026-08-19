import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CandidateProfilePage from './page';

vi.mock('@/lib/api', () => ({
  getCandidateProfile: vi.fn(async () => ({
    profile: { fullName: 'Vinoj Pillai' },
    completion: { percentage: 64, recommendedNextAction: 'Complete education.' },
    snapshot: {
      completionPercentage: 64,
      fullName: 'Vinoj Pillai',
      currentTitle: 'HR Manager',
      currentEmployer: 'TechAffinity Consulting Pvt Ltd',
      location: 'Bengaluru, INDIA',
      totalExperience: 17,
      currentCtcLpa: 20,
      phoneNumber: '9061190007',
      email: 'vinoj@example.com',
      noticePeriodDays: 30,
      updatedAt: '2026-08-05T09:00:00.000Z',
      resumeStatus: {
        filename: 'vinoj-pillai-resume.pdf',
        parsingStatusLabel: 'Parsed successfully',
        parsingStatusMessage: 'Resume details are available to review and apply to your profile.',
        uploadedAt: '2026-08-05T08:00:00.000Z',
        updatedAt: '2026-08-05T09:00:00.000Z',
        hasResume: true,
      },
    },
    resumeSuggestions: { hasSuggestions: false, items: [] },
  })),
}));

vi.mock('@/components/layout/workspace-shell', () => ({
  WorkspaceShell: ({ children, sidebarProfileLinks, defaultProfileExpanded }) => (
    <div>
      <div data-testid="workspace-shell" data-default-profile-expanded={String(Boolean(defaultProfileExpanded))}>
        {sidebarProfileLinks?.map((item) => <a key={item.id} href={item.href}>{item.label}</a>)}
      </div>
      {children}
    </div>
  ),
}));

vi.mock('@/components/sections/candidate-profile-page-content', () => ({
  CandidateProfilePageContent: ({ snapshot }) => (
    <div data-testid="profile-page-content">
      <section aria-label="Candidate profile summary">{snapshot.fullName}</section>
      <h2>{snapshot.resumeStatus.filename}</h2>
      <div data-testid="candidate-profile-form" />
    </div>
  ),
}));

describe('CandidateProfilePage', () => {
  test('passes profile submenu links to the sidebar and keeps content stacked without an active area card', async () => {
    render(await CandidateProfilePage());

    expect(screen.getByRole('heading', { name: 'Candidate profile' })).toBeInTheDocument();
    expect(screen.queryByText('Build a recruiter-ready profile from resume to review')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick links')).not.toBeInTheDocument();
    expect(screen.queryByText(/active area/i)).not.toBeInTheDocument();

    const snapshotRegion = screen.getByRole('region', { name: /candidate profile summary/i });
    const resumeCardHeading = screen.getByRole('heading', { name: 'vinoj-pillai-resume.pdf' });
    expect(snapshotRegion.compareDocumentPosition(resumeCardHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('region', { name: /candidate profile summary/i })).toHaveLength(1);

    expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-default-profile-expanded', 'true');
    const submenuLinks = screen.getAllByRole('link');
    expect(new Set(submenuLinks.map((link) => link.getAttribute('href'))).size).toBe(submenuLinks.length);
    expect(screen.getByRole('link', { name: 'Resume' })).toHaveAttribute('href', '#resume');
    const labels = submenuLinks.map((link) => link.textContent);
    expect(labels).toEqual([
      'Profile Snapshot',
      'Resume',
      'Resume Headline',
      'Profile Summary',
      'Key Skills',
      'Employment',
      'Education',
      'IT Skills',
      'Projects',
      'Certifications',
      'Career Profile',
      'Personal Details',
    ]);
    expect(screen.getByRole('link', { name: 'IT Skills' })).toHaveAttribute('href', '#it-skills');
    expect(screen.getByRole('link', { name: 'Personal Details' })).toHaveAttribute('href', '#personal-details');
  });
});
