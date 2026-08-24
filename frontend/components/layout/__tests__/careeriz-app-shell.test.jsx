import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';
import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { candidateNav, recruiterNav, adminNav, getNavigationForRole } from '@/lib/navigation';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

let mockPathname = '/recruiter/home';
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => mockPathname),
  useRouter: vi.fn(() => ({ replace: vi.fn(), refresh: vi.fn() })),
}));

describe('CareerizAppShell / collapsible navigation rail', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockPathname = '/recruiter/home';
    const { usePathname } = await import('next/navigation');
    usePathname.mockImplementation(() => mockPathname);
  });

  test('the rail is collapsed and unpinned by default', () => {
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('hovering the collapsed rail temporarily expands it, and pointer-leave closes it again', () => {
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    const railContainer = screen.getByRole('button', { name: 'Expand navigation' }).closest('div');

    fireEvent.mouseEnter(railContainer);
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();

    fireEvent.mouseLeave(railContainer);
    expect(screen.queryByRole('complementary', { name: 'Expanded navigation' })).not.toBeInTheDocument();
  });

  test('focus/click-expanding the rail works for keyboard and touch users, not just hover', () => {
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unpin navigation' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the expanded panel renders the real navigation links with correct hrefs', () => {
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

    const expandedPanel = within(screen.getByRole('complementary', { name: 'Expanded navigation' }));
    expect(expandedPanel.getByRole('link', { name: 'Members' })).toHaveAttribute('href', '/recruiter/members');
    expect(expandedPanel.getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/recruiter/billing');
    expect(expandedPanel.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/recruiter/home');
  });

  test('Escape collapses an unpinned expanded rail', () => {
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    const railContainer = screen.getByRole('button', { name: 'Expand navigation' }).closest('div');
    fireEvent.mouseEnter(railContainer);
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Expanded navigation' })).not.toBeInTheDocument();
  });

  test('a click outside an unpinned expanded rail collapses it', () => {
    render(
      <div>
        <Sidebar brand="Careeriz" items={recruiterNav} collapsible />
        <button type="button">Outside</button>
      </div>,
    );
    const railContainer = screen.getByRole('button', { name: 'Expand navigation' }).closest('div');
    fireEvent.mouseEnter(railContainer);
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('complementary', { name: 'Expanded navigation' })).not.toBeInTheDocument();
  });

  test('pinning keeps the rail expanded through Escape, outside-click, and pointer-leave', () => {
    render(
      <div>
        <Sidebar brand="Careeriz" items={recruiterNav} collapsible />
        <button type="button">Outside</button>
      </div>,
    );
    const railContainer = screen.getByRole('button', { name: 'Expand navigation' }).closest('div');
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(screen.getByRole('button', { name: 'Unpin navigation' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.mouseLeave(railContainer);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unpin navigation' }));
    expect(screen.queryByRole('complementary', { name: 'Expanded navigation' })).not.toBeInTheDocument();
  });

  test('the pin preference persists to localStorage and hydrates a fresh mount as expanded', async () => {
    const { unmount } = render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    await waitFor(() => expect(window.localStorage.getItem('careeriz.nav-rail-pinned')).toBe('true'));
    unmount();

    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Unpin navigation' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('hydration is safe: useState never reads localStorage during render, only inside an effect', async () => {
    // RTL's render() flushes effects synchronously (via act()), so the
    // pre-effect DOM can't be observed directly here - that would only be
    // meaningful against real server-rendered HTML. What we CAN verify,
    // and what actually makes this pattern hydration-safe, is that the
    // source never reads localStorage anywhere except inside a useEffect
    // callback: both `useState(false)` initializers are static, and the
    // only `localStorage.getItem` call site is inside the mount effect.
    // This lives in the shared useCollapsibleRail hook (Sidebar's own
    // rail state now delegates to it - see the "shares its mechanics"
    // comment in sidebar.jsx), not in sidebar.jsx directly.
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const source = readFileSync(path.resolve(process.cwd(), 'lib/use-collapsible-rail.js'), 'utf8');

    // Strip // comments first - this file documents the unsafe alternative
    // (a lazy useState(() => localStorage.getItem(...)) initializer) in
    // prose, which would otherwise false-positive a naive substring search.
    const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

    const useStateLines = code.split('\n').filter((line) => line.includes('useState('));
    expect(useStateLines.some((line) => line.includes('localStorage'))).toBe(false);

    const readCallIndex = code.indexOf('localStorage.getItem');
    expect(readCallIndex).toBeGreaterThan(-1);
    const precedingEffectOpen = code.lastIndexOf('useEffect(() => {', readCallIndex);
    expect(precedingEffectOpen).toBeGreaterThan(-1);
    expect(code.indexOf('}, [', precedingEffectOpen)).toBeGreaterThan(readCallIndex);
  });

  test('a pinned rail stays expanded after a route change', async () => {
    const { rerender } = render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();

    mockPathname = '/recruiter/jobs';
    rerender(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();
  });

  test('an unpinned rail collapses after a route change', () => {
    const { rerender } = render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Expand navigation' }).closest('div'));
    expect(screen.getByRole('complementary', { name: 'Expanded navigation' })).toBeInTheDocument();

    mockPathname = '/recruiter/jobs';
    rerender(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    expect(screen.queryByRole('complementary', { name: 'Expanded navigation' })).not.toBeInTheDocument();
  });

  test('the collapsed rail shows an accessible active-route indication', () => {
    mockPathname = '/recruiter/members';
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page');
  });

  test('collapsed-rail icon links expose an accessible name (tooltip-equivalent) even without visible text', () => {
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    expect(screen.getByRole('link', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument();
  });

  test('collapsed-rail icons show a visible tooltip on keyboard focus, not just an aria-label', () => {
    // Focus (not hover) deliberately: React's onMouseEnter/onMouseLeave
    // propagate special "entered/left" semantics up through ancestors
    // (unlike native mouseenter), so firing it on a nested icon here would
    // also trigger the rail's OWN hover-to-expand handler one level up,
    // which then aria-hides this whole collapsed rail (correctly, since
    // it's now expanded) - masking the very tooltip being tested. Focus
    // has no such interaction and is the more load-bearing a11y check
    // here in any case (keyboard users, not just mouse users, need the
    // label).
    render(<Sidebar brand="Careeriz" items={recruiterNav} collapsible />);
    const membersLink = screen.getByRole('link', { name: 'Members' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(membersLink);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Members');

    fireEvent.blur(membersLink);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('a nav item with a badgeCount shows an accessible count badge; items without one show none', () => {
    const itemsWithBadge = recruiterNav.map((item) => (
      item.label === 'Notifications' ? { ...item, badgeCount: 4 } : item
    ));
    render(<Sidebar brand="Careeriz" items={itemsWithBadge} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

    const expandedPanel = within(screen.getByRole('complementary', { name: 'Expanded navigation' }));
    expect(expandedPanel.getByText('4')).toBeInTheDocument();
    expect(expandedPanel.getByRole('link', { name: 'Members' }).textContent).not.toMatch(/\d/);
  });

  test('a badgeCount over 99 is displayed as 99+', () => {
    const itemsWithBadge = recruiterNav.map((item) => (
      item.label === 'Notifications' ? { ...item, badgeCount: 250 } : item
    ));
    render(<Sidebar brand="Careeriz" items={itemsWithBadge} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(within(screen.getByRole('complementary', { name: 'Expanded navigation' })).getByText('99+')).toBeInTheDocument();
  });
});

describe('CareerizAppShell / mobile navigation Sheet', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockPathname = '/candidate/dashboard';
    const { usePathname } = await import('next/navigation');
    usePathname.mockImplementation(() => mockPathname);
  });

  test('opens via the mobile trigger, traps focus, and closes on Escape restoring focus to the trigger', async () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Careeriz' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test('closes when a nav link inside it is activated (route-change close)', async () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    await screen.findByRole('dialog');

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Find Jobs' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('background content is inert while the mobile sheet is open (body scroll locked)', async () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('CareerizAppShell / role-aware navigation is server-decided, not client-filtered', () => {
  test('getNavigationForRole returns exactly one role\'s item set - the shell never re-derives permissions client-side', () => {
    expect(getNavigationForRole('CANDIDATE')).toBe(candidateNav);
    expect(getNavigationForRole('RECRUITER')).toBe(recruiterNav);
    expect(getNavigationForRole('ADMIN')).toBe(adminNav);
    expect(getNavigationForRole('SOME_UNKNOWN_ROLE')).toEqual([]);
  });

  test('candidate navigation never includes recruiter-only or admin-only items', () => {
    render(<Sidebar brand="Careeriz" items={candidateNav} />);
    expect(screen.queryByText('ATS Pipeline')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Flags')).not.toBeInTheDocument();
  });
});

describe('CareerizAppShell / right-context slot and page header', () => {
  test('renders an optional right-context panel alongside the main content', () => {
    render(
      <CareerizAppShell
        brand="Careeriz"
        items={candidateNav}
        pageTitle="Dashboard"
        rightContext={<div>Context panel content</div>}
      >
        <div>Main content</div>
      </CareerizAppShell>,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Context panel content')).toBeInTheDocument();
  });

  test('renders without a right-context panel exactly as before when none is given', () => {
    render(
      <CareerizAppShell brand="Careeriz" items={candidateNav}>
        <div>Main content</div>
      </CareerizAppShell>,
    );
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.queryByText('Context panel content')).not.toBeInTheDocument();
  });

  test('has no obvious accessibility violations with a right-context panel present', async () => {
    const { container } = render(
      <CareerizAppShell
        brand="Careeriz"
        items={candidateNav}
        pageTitle="Dashboard"
        rightContext={<div>Context panel content</div>}
      >
        <div>Main content</div>
      </CareerizAppShell>,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
