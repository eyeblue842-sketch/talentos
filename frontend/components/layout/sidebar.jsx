"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  BarChart3,
  Bell,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Database,
  FilePenLine,
  GitPullRequestArrow,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Mail,
  Menu,
  Pin,
  PinOff,
  Search,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  ToggleRight,
  Users,
  WalletCards,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Sheet } from '@/components/ui/sheet';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const RAIL_PINNED_STORAGE_KEY = 'careeriz.nav-rail-pinned';

const iconMap = {
  BarChart3,
  Bell,
  BellRing,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Database,
  FilePenLine,
  GitPullRequestArrow,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Mail,
  Menu,
  ScrollText,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  ToggleRight,
  Users,
  WalletCards,
};

export function Sidebar({ brand, items, profileLinks = [], defaultProfileExpanded = false, collapsible = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(defaultProfileExpanded || pathname === '/candidate/profile');
  const [expandedGroups, setExpandedGroups] = useState(() => ({}));
  // Collapsed icon rail (opt-in via `collapsible`) expands into a full-nav
  // overlay on hover OR click - never hover-only, so keyboard/touch users can
  // reach it too. Expanding never resizes the grid column the rail sits in,
  // so the page content next to it never shifts.
  // SSR and the first client render both start unpinned/collapsed
  // (identical output, no hydration mismatch). The persisted preference is
  // only ever read inside an effect - after hydration - and applied in a
  // second, client-only render, matching React's documented safe pattern
  // for localStorage-backed UI state.
  const [railExpanded, setRailExpanded] = useState(false);
  const [railPinned, setRailPinned] = useState(false);
  const [railHydrated, setRailHydrated] = useState(false);
  const [lastSeenPathname, setLastSeenPathname] = useState(pathname);
  const railRef = useRef(null);
  // Mirrors the resume-search-rail fix: an explicit collapse click can leave
  // the cursor sitting on the now-revealed collapsed rail, and some browsers
  // re-fire mouseenter on that DOM swap. Suppress hover-driven reopen briefly
  // after any explicit collapse so it can't immediately undo the click.
  const suppressRailHoverUntilRef = useRef(0);

  function collapseRail() {
    suppressRailHoverUntilRef.current = Date.now() + 400;
    setRailPinned(false);
    setRailExpanded(false);
  }

  useEffect(() => {
    if (!collapsible) return;
    // This IS the sync-from-an-external-system case
    // react-hooks/set-state-in-effect means to allow: it reads localStorage
    // (external to React) and applies it once, after mount. A lazy
    // useState(() => localStorage.getItem(...)) initializer is not a safe
    // alternative here - client components still render once during
    // SSR/RSC and again on the client BEFORE hydration completes, so a
    // lazy initializer would read real localStorage on that pre-hydration
    // client render while the server had none, producing the exact
    // hydration mismatch this effect exists to avoid.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      if (window.localStorage.getItem(RAIL_PINNED_STORAGE_KEY) === 'true') {
        setRailPinned(true);
        setRailExpanded(true);
      }
    } catch {
      // localStorage unavailable (privacy mode, disabled storage, etc.) -
      // fall back to the default unpinned/collapsed state.
    } finally {
      setRailHydrated(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only ever read the stored preference once, right after mount.
  }, [collapsible]);

  useEffect(() => {
    if (!collapsible || !railHydrated) return;
    try {
      window.localStorage.setItem(RAIL_PINNED_STORAGE_KEY, String(railPinned));
    } catch {
      // Ignore write failures - the preference simply won't persist.
    }
  }, [collapsible, railHydrated, railPinned]);

  useEffect(() => {
    if (!collapsible || !railExpanded || railPinned) return undefined;
    function handlePointerDown(event) {
      if (railRef.current && !railRef.current.contains(event.target)) collapseRail();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [collapsible, railExpanded, railPinned]);

  useEffect(() => {
    if (!collapsible || !railExpanded) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !railPinned) collapseRail();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsible, railExpanded, railPinned]);

  // Route-change close: a temporarily (hover/click) expanded rail returns to
  // collapsed after navigating, unless pinned open. Adjusted during render
  // (React's documented pattern for resetting state when a prop/value
  // changes) rather than in an effect, since this pathname comparison has
  // nothing to synchronize with an external system - see
  // https://react.dev/learn/you-might-not-need-an-effect. The very first
  // render trivially skips this (lastSeenPathname already equals pathname),
  // so mount never fires a spurious collapse of a rail just restored from
  // a persisted pin.
  if (pathname !== lastSeenPathname) {
    setLastSeenPathname(pathname);
    if (collapsible && railExpanded && !railPinned) {
      setRailExpanded(false);
    }
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  const flatItems = items.flatMap((item) => item.children ? item.children : [item]);
  const activeItem = flatItems.find((item) => isActiveHref(item.href, item.exact));
  const notificationItem = flatItems.find((item) => item.href?.includes('/notifications'));
  const settingsItem = flatItems.find((item) => item.href?.includes('/settings'));

  function isActiveHref(href, exact = false) {
    if (!href) return false;
    if (exact) return pathname === href;
    return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  }

  function isGroupExpanded(item) {
    if (!item.children?.length) return false;
    if (expandedGroups[item.label] !== undefined) {
      return expandedGroups[item.label];
    }
    return item.children.some((child) => isActiveHref(child.href, child.exact));
  }

  function toggleGroup(itemLabel) {
    setExpandedGroups((current) => ({
      ...current,
      [itemLabel]: !(current[itemLabel] ?? false),
    }));
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // A recruiter logging out should be able to log back in again via the
      // employer chooser, not land on the candidate login page - the /auth
      // compatibility page has no way to know this was a recruiter session
      // once the cookie is gone.
      router.replace(pathname.startsWith('/recruiter') ? '/hire' : '/auth');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function navigationList(linkClassName, nested = false) {
    return items.map((item) => {
      const active = isActiveHref(item.href, item.exact);
      const Icon = iconMap[item.icon] || LayoutDashboard;
      const isProfileItem = item.label === 'Profile' && profileLinks.length > 0;
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;

      if (isProfileItem) {
        return (
          <div key={item.href} className="grid gap-2">
            <div
              className={cn(
                linkClassName,
                active
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-white hover:text-[var(--color-text)]',
              )}
            >
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
              <button
                type="button"
                aria-label="Profile"
                aria-expanded={profileExpanded}
                onClick={() => setProfileExpanded((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-white/80 hover:text-[var(--color-text)]"
              >
                {profileExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              </button>
            </div>
            {profileExpanded ? (
              <div className={cn(
                'ml-6 grid gap-1 border-l border-[var(--color-border)] pl-3',
                nested ? 'ml-4 pl-2' : '',
              )}>
                {profileLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium transition',
                      'text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
                    )}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      }

      if (hasChildren) {
        const expanded = isGroupExpanded(item);
        return (
          <div key={item.label} className="grid gap-2">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleGroup(item.label)}
              className={cn(
                linkClassName,
                'w-full justify-between',
                item.children.some((child) => isActiveHref(child.href, child.exact))
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-white hover:text-[var(--color-text)]',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </span>
              {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
            {expanded ? (
              <div className={cn(
                'ml-6 grid gap-1 border-l border-[var(--color-border)] pl-3',
                nested ? 'ml-4 pl-2' : '',
              )}>
                {item.children.map((child) => {
                  const childActive = isActiveHref(child.href, child.exact);
                  return (
                    <Link
                      key={child.id || child.href}
                      href={child.href}
                      aria-current={childActive ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium transition',
                        childActive
                          ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      }

      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={() => setMobileOpen(false)}
          className={cn(
            linkClassName,
            active
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-white hover:text-[var(--color-text)]',
          )}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{item.label}</span>
          {item.badgeCount > 0 ? (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 text-[10px] font-semibold leading-none text-white">
              {item.badgeCount > 99 ? '99+' : item.badgeCount}
            </span>
          ) : null}
        </Link>
      );
    });
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/92 p-3 shadow-[var(--shadow-md)] backdrop-blur lg:hidden">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Workspace</p>
          <p className="truncate text-base font-semibold text-[var(--color-text)]">{brand}</p>
        </div>
        <div className="flex items-center gap-2">
          {notificationItem ? (
            <Button as="a" href={notificationItem.href} variant="ghost" size="icon" aria-label="Open notifications">
              <Bell size={18} aria-hidden="true" />
            </Button>
          ) : null}
          <DropdownMenu
            trigger={(
              <Button variant="ghost" size="icon" aria-label="Open profile menu">
                <Avatar size="sm" name={brand} />
              </Button>
            )}
            items={[
              activeItem ? { label: activeItem.label, href: activeItem.href, icon: LayoutDashboard } : null,
              settingsItem ? { label: 'Settings', href: settingsItem.href, icon: Settings2 } : null,
              { label: isLoggingOut ? 'Logging out...' : 'Logout', onSelect: handleLogout, icon: LogOut },
            ].filter(Boolean)}
          />
          <Button variant="outline" size="icon" aria-label="Open navigation menu" onClick={() => setMobileOpen(true)}>
            <Menu size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Sheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={brand}
        className="lg:hidden"
      >
        <nav className="grid gap-2">
          {navigationList('flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm font-medium', true)}
        </nav>
        <div className="mt-6">
          <Button type="button" variant="outline" className="w-full justify-center" onClick={handleLogout} leadingIcon={LogOut} disabled={isLoggingOut}>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      </Sheet>

      {collapsible ? (
        <div
          ref={railRef}
          className="sticky top-6 hidden self-start lg:block"
          onMouseEnter={() => {
            if (railPinned || Date.now() < suppressRailHoverUntilRef.current) return;
            setRailExpanded(true);
          }}
          onMouseLeave={() => {
            if (!railPinned) setRailExpanded(false);
          }}
        >
          <aside
            aria-hidden={railExpanded}
            className={cn(
              'flex w-[var(--shell-width-collapsed)] flex-col items-center gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/88 py-4 shadow-[var(--shadow-lg)] backdrop-blur lg:flex lg:min-h-[calc(100vh-4rem)]',
              railExpanded && 'invisible',
            )}
          >
            <Avatar name={brand} size="sm" />
            <button
              type="button"
              aria-expanded={railExpanded}
              aria-pressed={railPinned}
              aria-label={railExpanded ? 'Collapse navigation' : 'Expand navigation'}
              onClick={() => { setRailExpanded(true); setRailPinned(true); }}
              className="mt-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <nav className="mt-2 grid gap-1">
              {items.map((item) => {
                const Icon = iconMap[item.icon] || LayoutDashboard;
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                const active = hasChildren
                  ? item.children.some((child) => isActiveHref(child.href, child.exact))
                  : isActiveHref(item.href, item.exact);
                const iconButtonClass = cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition',
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]',
                );
                const badge = item.badgeCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold leading-none text-white"
                  >
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                ) : null;

                if (hasChildren) {
                  return (
                    <Tooltip key={item.label} content={item.label}>
                      <button
                        type="button"
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          setExpandedGroups((current) => ({ ...current, [item.label]: true }));
                          setRailExpanded(true);
                        }}
                        className={cn(iconButtonClass, 'relative')}
                      >
                        <Icon size={18} aria-hidden="true" />
                        {badge}
                      </button>
                    </Tooltip>
                  );
                }
                return (
                  <Tooltip key={item.href} content={item.label}>
                    <Link href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined} className={cn(iconButtonClass, 'relative')}>
                      <Icon size={18} aria-hidden="true" />
                      {badge}
                    </Link>
                  </Tooltip>
                );
              })}
            </nav>
          </aside>

          {railExpanded ? (
            <aside aria-label="Expanded navigation" className="absolute left-0 top-0 z-40 flex w-[var(--shell-width-expanded)] flex-col rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/97 p-5 shadow-[var(--shadow-floating)] backdrop-blur lg:min-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={brand} size="md" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Careeriz</p>
                    <h2 className="truncate text-xl font-semibold text-[var(--color-text)]">{brand}</h2>
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={railPinned}
                  aria-label={railPinned ? 'Unpin navigation' : 'Pin navigation open'}
                  onClick={() => (railPinned ? collapseRail() : setRailPinned(true))}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    railPinned ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]',
                  )}
                >
                  {railPinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
                </button>
              </div>

              <nav className="mt-6 grid gap-2 overflow-y-auto">
                {navigationList('flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm font-medium')}
              </nav>

              <div className="mt-auto grid gap-3 pt-6">
                <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={brand} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">{brand}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">AI-Powered Talent Intelligence Platform</p>
                    </div>
                  </div>
                  <DropdownMenu
                    trigger={(
                      <Button variant="ghost" size="icon" aria-label="Open workspace menu">
                        <Users size={18} aria-hidden="true" />
                      </Button>
                    )}
                    items={[
                      settingsItem ? { label: 'Settings', href: settingsItem.href, icon: Settings2 } : null,
                      notificationItem ? { label: 'Notifications', href: notificationItem.href, icon: Bell } : null,
                      { label: isLoggingOut ? 'Logging out...' : 'Logout', onSelect: handleLogout, icon: LogOut },
                    ].filter(Boolean)}
                  />
                </div>
                <Button type="button" variant="outline" className="w-full justify-center" onClick={handleLogout} leadingIcon={LogOut} disabled={isLoggingOut}>
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </Button>
              </div>
            </aside>
          ) : null}
        </div>
      ) : (
        <aside className="hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/88 p-5 shadow-[var(--shadow-lg)] backdrop-blur lg:flex lg:min-h-[calc(100vh-4rem)] lg:flex-col">
          <div className="flex items-center gap-3">
            <Avatar name={brand} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Careeriz</p>
              <h2 className="truncate text-xl font-semibold text-[var(--color-text)]">{brand}</h2>
            </div>
          </div>
          <nav className="mt-6 grid gap-2">
            {navigationList('flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm font-medium')}
          </nav>

          <div className="mt-auto grid gap-3 pt-6">
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-3 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={brand} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{brand}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">AI-Powered Talent Intelligence Platform</p>
                </div>
              </div>
              <DropdownMenu
                trigger={(
                  <Button variant="ghost" size="icon" aria-label="Open workspace menu">
                    <Users size={18} aria-hidden="true" />
                  </Button>
                )}
                items={[
                  settingsItem ? { label: 'Settings', href: settingsItem.href, icon: Settings2 } : null,
                  notificationItem ? { label: 'Notifications', href: notificationItem.href, icon: Bell } : null,
                  { label: isLoggingOut ? 'Logging out...' : 'Logout', onSelect: handleLogout, icon: LogOut },
                ].filter(Boolean)}
              />
            </div>
            <Button type="button" variant="outline" className="w-full justify-center" onClick={handleLogout} leadingIcon={LogOut} disabled={isLoggingOut}>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </aside>
      )}
    </>
  );
}

