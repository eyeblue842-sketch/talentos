"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
  Search,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  ToggleRight,
  Users,
  WalletCards,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

export function Sidebar({ brand, items }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const notificationItem = items.find((item) => item.href.includes('/notifications'));
  const settingsItem = items.find((item) => item.href.includes('/settings'));

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/auth');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function navigationList(linkClassName) {
    return items.map((item) => {
      const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
      const Icon = iconMap[item.icon] || LayoutDashboard;
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

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-page)] p-5 shadow-[var(--shadow-floating)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Careeriz</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{brand}</h2>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)}>
                <Menu size={18} aria-hidden="true" />
              </Button>
            </div>
            <nav className="mt-6 grid gap-2">
              {navigationList('flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm font-medium')}
            </nav>
            <div className="mt-auto pt-6">
              <Button type="button" variant="outline" className="w-full justify-center" onClick={handleLogout} leadingIcon={LogOut} disabled={isLoggingOut}>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/88 p-5 shadow-[var(--shadow-lg)] backdrop-blur lg:flex lg:min-h-[calc(100vh-4rem)] lg:flex-col">
        <div className="flex items-center gap-3">
          <Avatar name={brand} size="md" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Careeriz</p>
            <h2 className="truncate text-xl font-semibold text-[var(--color-text)]">{brand}</h2>
          </div>
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Active area</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-text)]">{activeItem?.label || 'Workspace'}</p>
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
    </>
  );
}

