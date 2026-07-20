import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, test, vi } from 'vitest';
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
  test('role-specific navigation does not leak recruiter links to candidates', () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);
    expect(screen.queryByText('ATS Pipeline')).not.toBeInTheDocument();
    expect(screen.getAllByText('Applications').length).toBeGreaterThan(0);
  });

  test('role-specific navigation does not leak candidate-only links to recruiters', () => {
    render(<Sidebar brand="Hiring Ops" items={recruiterNav} />);
    expect(screen.queryByText('Saved Jobs')).not.toBeInTheDocument();
    expect(screen.getAllByText('ATS Pipeline').length).toBeGreaterThan(0);
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
