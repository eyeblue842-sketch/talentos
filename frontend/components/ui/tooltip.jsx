"use client";

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({ content, children, className }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      {visible ? (
        <span id={id} role="tooltip" className="absolute bottom-[calc(100%+0.5rem)] left-1/2 z-40 w-max max-w-56 -translate-x-1/2 rounded-[var(--radius-md)] bg-slate-950 px-3 py-2 text-xs text-white shadow-[var(--shadow-lg)]">
          {content}
        </span>
      ) : null}
    </span>
  );
}
