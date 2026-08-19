import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { candidateNav, recruiterNav, adminNav } from '@/lib/navigation';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/candidate/dashboard'),
  useRouter: vi.fn(() => ({ replace: vi.fn(), refresh: vi.fn() })),
}));

describe('workspace shell and navigation', () => {
  beforeEach(async () => {
    const { usePathname } = await import('next/navigation');
    usePathname.mockReturnValue('/candidate/dashboard');
  });

  test('role-specific navigation does not leak recruiter links to candidates', () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);
    expect(screen.queryByText('ATS Pipeline')).not.toBeInTheDocument();
    expect(screen.getAllByText('Applications').length).toBeGreaterThan(0);
  });

  test('role-specific navigation does not leak candidate-only links to recruiters', async () => {
    const { usePathname } = await import('next/navigation');
    usePathname.mockReturnValue('/recruiter/home');
    render(<Sidebar brand="Hiring Ops" items={recruiterNav} />);

    expect(screen.queryByText('Saved Jobs')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/recruiter/home');
    expect(screen.getByRole('button', { name: 'Recruitment' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('recruitment menu expands and stays open on recruiter workflow routes', async () => {
    const { usePathname } = await import('next/navigation');
    usePathname.mockReturnValue('/recruiter/ats');

    render(<Sidebar brand="Hiring Ops" items={recruiterNav} />);

    expect(screen.getByRole('button', { name: 'Recruitment' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/recruiter');
    expect(screen.getByRole('link', { name: 'Job Posts' })).toHaveAttribute('href', '/recruiter/jobs');
    expect(screen.getByRole('link', { name: 'Job Responses' })).toHaveAttribute('href', '/recruiter/job-responses');
    expect(screen.getByRole('link', { name: 'Resume Search' })).toHaveAttribute('href', '/recruiter/database');
    expect(screen.getByRole('link', { name: 'ATS Pipeline' })).toHaveAttribute('href', '/recruiter/ats');
    expect(screen.getByRole('link', { name: 'Interviews' })).toHaveAttribute('href', '/recruiter/interviews');
    expect(screen.getByRole('link', { name: 'ATS Pipeline' })).toHaveAttribute('aria-current', 'page');
  });

  test('recruitment menu can be toggled from the recruiter sidebar', async () => {
    const { usePathname } = await import('next/navigation');
    usePathname.mockReturnValue('/recruiter/home');

    render(<Sidebar brand="Hiring Ops" items={recruiterNav} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recruitment' }));
    expect(screen.getByRole('button', { name: 'Recruitment' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Interviews' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Job Responses' })).toBeInTheDocument();
  });

  test('sidebar does not render a separate active area box', () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);

    expect(screen.queryByText(/active area/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Profile' })).toHaveLength(1);
  });

  test('candidate profile sidebar expands nested profile sub-functions on the profile route', async () => {
    const { usePathname } = await import('next/navigation');
    usePathname.mockReturnValue('/candidate/profile');
    const profileLinks = [
      { id: 'profile-snapshot', label: 'Profile Snapshot', href: '#profile-snapshot' },
      { id: 'resume', label: 'Resume', href: '#resume' },
      { id: 'resume-headline', label: 'Resume Headline', href: '#resume-headline' },
      { id: 'key-skills', label: 'Key Skills', href: '#key-skills' },
      { id: 'employment', label: 'Employment', href: '#employment' },
      { id: 'education', label: 'Education', href: '#education' },
      { id: 'it-skills', label: 'IT Skills', href: '#it-skills' },
      { id: 'projects', label: 'Projects', href: '#projects' },
      { id: 'profile-summary', label: 'Profile Summary', href: '#profile-summary' },
      { id: 'certifications', label: 'Certifications', href: '#certifications' },
      { id: 'career-profile', label: 'Career Profile', href: '#career-profile' },
      { id: 'personal-details', label: 'Personal Details', href: '#personal-details' },
    ];

    render(
      <Sidebar
        brand="Careeriz"
        items={candidateNav}
        profileLinks={profileLinks}
        defaultProfileExpanded
      />,
    );

    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link', { name: 'Profile' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Profile Snapshot' })).toHaveAttribute('href', '#profile-snapshot');
    expect(screen.getByRole('link', { name: 'Resume' })).toHaveAttribute('href', '#resume');
    expect(screen.getByRole('link', { name: 'IT Skills' })).toHaveAttribute('href', '#it-skills');
    expect(screen.getByRole('link', { name: 'Career Profile' })).toHaveAttribute('href', '#career-profile');
  });

  test('application shell renders without breaking current route guards', () => {
    render(
      <WorkspaceShell brand="Careeriz" items={candidateNav}>
        <div>Shell content</div>
      </WorkspaceShell>,
    );

    expect(screen.getByText('Shell content')).toBeInTheDocument();
    expect(screen.getAllByText('Careeriz').length).toBeGreaterThan(0);
  });

  test('development showcase is not exposed as a normal production navigation item', () => {
    const allNav = [...candidateNav, ...recruiterNav, ...adminNav];
    expect(allNav.some((item) => item.href === '/dev/design-system')).toBe(false);
  });

  test('shell components do not produce obvious accessibility violations', async () => {
    const { container } = render(
      <WorkspaceShell brand="Careeriz" items={candidateNav}>
        <div>Dashboard</div>
      </WorkspaceShell>,
    );

    expect((await axe(container)).violations).toHaveLength(0);
  });
});
