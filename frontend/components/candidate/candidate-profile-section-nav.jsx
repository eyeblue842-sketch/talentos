"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sticky horizontal sub-navigation of profile sections (replaces the old sidebar
// "Profile" sub-tabs). Clicking smooth-scrolls to the section; a scrollspy keeps
// the active pill in sync. When the pills overflow, left/right arrow buttons
// appear so every section stays reachable.
export function CandidateProfileSectionNav({ links = [] }) {
  const [active, setActive] = useState(links[0]?.id || '');
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const scrollerRef = useRef(null);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, links]);

  // Scrollspy: keep the active pill in sync as the candidate scrolls the page.
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
        { rootMargin: '-120px 0px -65% 0px', threshold: 0 },
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

  // Keep the active pill scrolled into view within the bar.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !active) return;
    const pill = el.querySelector(`[data-pill="${active}"]`);
    if (pill) pill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  function nudge(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(200, el.clientWidth * 0.6), behavior: 'smooth' });
  }

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
      <div className="relative flex items-center">
        {canLeft ? (
          <button
            type="button"
            aria-label="Scroll sections left"
            onClick={() => nudge(-1)}
            className="absolute left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] shadow-sm hover:text-[var(--color-primary)]"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        ) : null}

        <nav
          ref={scrollerRef}
          aria-label="Profile sections"
          className={cn(
            'flex gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            canLeft ? 'pl-10' : '',
            canRight ? 'pr-10' : '',
          )}
        >
          {links.map((link) => (
            <a
              key={link.id}
              data-pill={link.id}
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

        {canRight ? (
          <button
            type="button"
            aria-label="Scroll sections right"
            onClick={() => nudge(1)}
            className="absolute right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] shadow-sm hover:text-[var(--color-primary)]"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
