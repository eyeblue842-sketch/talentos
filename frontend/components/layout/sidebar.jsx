"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  Database,
  FilePenLine,
  GitPullRequestArrow,
  LayoutDashboard,
  Search,
  Settings2,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';

const iconMap = {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  Database,
  FilePenLine,
  GitPullRequestArrow,
  LayoutDashboard,
  Search,
  Settings2,
  Sparkles,
  Users,
  WalletCards,
};

export function Sidebar({ brand, items }) {
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
    <aside className="rounded-[28px] border border-[var(--line)] bg-[#102418] p-5 text-white shadow-[0_20px_60px_rgba(16,36,24,0.18)]">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-white/56">Workspace</p>
        <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">{brand}</h2>
      </div>
      <nav className="mt-8 space-y-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          const Icon = iconMap[item.icon] || LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                active ? 'bg-white text-[#102418]' : 'text-white/72 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="mt-8 w-full rounded-2xl border border-white/14 px-4 py-3 text-sm font-semibold text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </button>
    </aside>
  );
}

