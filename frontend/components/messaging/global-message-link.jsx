'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useEffect, useState } from 'react';

function displayCount(count) {
  return count > 99 ? '99+' : String(count);
}

export function GlobalMessageLink() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const response = await fetch('/api/messages/unread-count', { credentials: 'include', cache: 'no-store' }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => null);
      const nextCount = Number(payload?.data?.count ?? payload?.data?.unreadCount ?? 0);
      if (mounted) setUnreadCount(Number.isFinite(nextCount) ? Math.max(0, nextCount) : 0);
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const count = displayCount(unreadCount);
  return (
    <Link
      href="/recruiter/home?tab=connections&section=messages"
      aria-label={unreadCount > 0 ? `Messages, ${count} unread` : 'Messages'}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
    >
      <Mail size={18} aria-hidden="true" />
      {unreadCount > 0 ? <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[11px] font-semibold text-white">{count}</span> : null}
    </Link>
  );
}
