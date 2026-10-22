"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, LogOut, Settings2 } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/dropdown-menu';

// Recruiter counterpart of the candidate "Me" menu: the company logo opens
// Company profile, Settings and Logout.
export function RecruiterAccountMenu({ brand = 'Company', brandLogoUrl = null }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const initial = String(brand || 'C').trim().charAt(0).toUpperCase() || 'C';

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/hire');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu
      align="right"
      trigger={(
        <button
          type="button"
          aria-label="Open your account menu"
          className="flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-2 pr-3 text-sm font-medium text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-primary-soft)] text-sm font-semibold text-[var(--color-primary)]">
            {brandLogoUrl && !logoFailed ? (
              <img src={brandLogoUrl} alt="" className="h-full w-full object-cover" onError={() => setLogoFailed(true)} />
            ) : initial}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{brand}</span>
          <ChevronDown size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
        </button>
      )}
      items={[
        { label: 'Company profile', href: '/recruiter/company/edit', icon: Building2 },
        { label: 'Settings', href: '/recruiter/settings', icon: Settings2 },
        { label: isLoggingOut ? 'Logging out…' : 'Logout', onSelect: handleLogout, icon: LogOut },
      ]}
    />
  );
}
