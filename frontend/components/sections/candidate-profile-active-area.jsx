'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function CandidateProfileActiveArea({
  profileLinks = [],
  defaultProfileExpanded = true,
  className = '',
}) {
  const [profileExpanded, setProfileExpanded] = useState(defaultProfileExpanded);

  return (
    <Card className={`w-full max-w-[320px] rounded-[32px] p-5 ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Active Area</p>
      <nav aria-label="Profile section navigation" className="mt-4 grid gap-2">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--color-surface)]/70 px-3 py-3">
          <button
            type="button"
            aria-label="Profile"
            aria-expanded={profileExpanded}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[var(--color-text)]"
            onClick={() => setProfileExpanded((current) => !current)}
          >
            <span>Profile</span>
            {profileExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
          {profileExpanded ? (
            <div className="mt-3 grid gap-1 pl-1">
              {profileLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="rounded-xl px-3 py-2 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--soft)] hover:text-[var(--brand)]"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </Card>
  );
}
