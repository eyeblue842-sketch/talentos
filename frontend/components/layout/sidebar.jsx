"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

  return (
    <aside className="rounded-[28px] border border-[var(--line)] bg-[#102418] p-5 text-white shadow-[0_20px_60px_rgba(16,36,24,0.18)]">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-white/56">Workspace</p>
        <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">{brand}</h2>
      </div>
      <nav className="mt-8 space-y-2">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = iconMap[item.icon] || LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}

