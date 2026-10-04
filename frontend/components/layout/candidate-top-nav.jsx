"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronDown,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  User,
  UserRound,
  Users,
} from 'lucide-react';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { cn } from '@/lib/utils';

// Primary top-bar destinations (LinkedIn-style). Profile, Settings and Logout
// live in the "Me" dropdown on the right; Notifications is the bell.
const PRIMARY_LINKS = [
  { label: 'Home', href: '/candidate/dashboard', icon: LayoutDashboard, match: ['/candidate/dashboard'] },
  { label: 'Jobs', href: '/candidate/jobs', icon: Search, match: ['/candidate/jobs', '/candidate/saved-jobs', '/candidate/applications', '/candidate/interviews', '/candidate/offers'] },
  { label: 'Network', href: '/candidate/network', icon: Users, match: ['/candidate/network', '/candidate/messages'] },
  { label: 'Resumes', href: '/candidate/resumes', icon: FilePenLine, match: ['/candidate/resumes'] },
  { label: 'Profile', href: '/candidate/profile', icon: User, match: ['/candidate/profile'] },
];

function isActive(pathname, matches) {
  return matches.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function CandidateTopNav({ brand = 'Careeriz', brandLogoUrl = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/candidate/dashboard" className="flex shrink-0 items-center gap-2" aria-label="Careeriz home">
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">C</span>
          )}
          <span className="hidden text-lg font-semibold tracking-tight text-[var(--color-text)] sm:inline">{brand}</span>
        </Link>

        {/* Primary nav */}
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Primary">
          {PRIMARY_LINKS.map((item) => {
            const active = isActive(pathname, item.match);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-w-[3.5rem] flex-col items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition sm:px-3',
                  active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
                )}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="mt-0.5 hidden sm:inline">{item.label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -bottom-[9px] left-2 right-2 h-0.5 rounded-full transition',
                    active ? 'bg-[var(--color-primary)]' : 'bg-transparent',
                  )}
                />
              </Link>
            );
          })}

          <div className="mx-1 hidden h-8 w-px bg-[var(--color-border)] sm:block" />

          <div className="flex flex-col items-center justify-center">
            <NotificationBell href="/candidate/notifications" />
          </div>

          {/* Me menu */}
          <DropdownMenu
            align="right"
            trigger={(
              <button
                type="button"
                aria-label="Open your account menu"
                className="flex min-w-[3.5rem] flex-col items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                <span className="flex items-center gap-0.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <UserRound size={15} aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-0.5 hidden items-center gap-0.5 sm:flex">Me <ChevronDown size={12} aria-hidden="true" /></span>
              </button>
            )}
            items={[
              { label: 'View profile', href: '/candidate/profile', icon: User },
              { label: 'Settings', href: '/candidate/settings', icon: Settings2 },
              { label: isLoggingOut ? 'Logging out…' : 'Logout', onSelect: handleLogout, icon: LogOut },
            ]}
          />
        </nav>
      </div>
    </header>
  );
}
