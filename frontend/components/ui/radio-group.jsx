"use client";

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function RadioGroup({ legend, options, name, defaultValue, className }) {
  const generatedName = useId();
  const groupName = name || generatedName;

  return (
    <fieldset className={cn('grid gap-3', className)}>
      {legend ? <legend className="text-sm font-semibold text-[var(--color-text)]">{legend}</legend> : null}
      <div className="grid gap-3">
        {options.map((option) => (
          <label key={option.value} className="inline-flex items-start gap-3 text-sm text-[var(--color-text)]">
            <input
              type="radio"
              name={groupName}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="mt-0.5 h-4 w-4 border-[var(--color-border-strong)] text-[var(--color-primary)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
            />
            <span className="grid gap-1">
              <span className="font-medium">{option.label}</span>
              {option.description ? <span className="text-[var(--color-text-muted)]">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
