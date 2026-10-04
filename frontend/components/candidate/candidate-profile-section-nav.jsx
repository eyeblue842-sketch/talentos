"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Sticky horizontal sub-navigation of profile sections (replaces the old sidebar
// "Profile" sub-tabs). Clicking smooth-scrolls to the section; a scrollspy keeps
// the active pill in sync as the candidate scrolls.
export function CandidateProfileSectionNav({ links = [] }) {
  const [active, setActive] = useState(links[0]?.id || '');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined;
    let observer;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]?.target?.id) setActive(visible[0].target.id);
        },
        { rootMargin: '-100px 0px -65% 0px', threshold: 0 },
      );
      links.forEach((link) => {
        const el = document.getElementById(link.id);
        if (el) observer.observe(el);
      });
    } catch {
      return undefined;
    }
    return () => observer?.disconnect();
  }, [links]);

  function handleClick(event, link) {
    const el = document.getElementById(link.id);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(link.id);
    try { window.history.replaceState(null, '', `#${link.id}`); } catch { /* ignore */ }
  }

  if (!links.length) return null;

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-[var(--color-border)] bg-white/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <nav aria-label="Profile sections" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            aria-current={active === link.id ? 'true' : undefined}
            onClick={(event) => handleClick(event, link)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition',
              active === link.id
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
