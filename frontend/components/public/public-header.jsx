"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const primaryNav = [
  { label: 'Careeriz Jobs', href: '/candidate' },
  { label: 'Careeriz Hire', href: '/hire' },
  { label: 'Companies', href: '/companies' },
];

function NavLink({ item, mobile = false, onNavigate }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-primary)]',
        mobile ? 'rounded-[var(--radius-md)] px-3 py-2 hover:bg-[var(--color-bg-muted)]' : '',
      )}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  );
}

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color:rgba(248,250,252,0.84)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:px-10">
        <Link href="/" className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-white text-lg font-semibold text-[var(--color-primary)] shadow-[var(--shadow-sm)]">
              C
            </span>
            <span className="min-w-0">
              <span className="block font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                Careeriz
              </span>
              <span className="block text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Talent Intelligence
              </span>
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-card)] lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2 px-6 py-4">
            {primaryNav.map((item) => (
              <NavLink key={item.href} item={item} mobile onNavigate={() => setMobileOpen(false)} />
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
