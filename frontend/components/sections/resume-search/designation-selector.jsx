"use client";

import { Input } from '@/components/ui/input';

export function DesignationSelector({ formState, onPatch }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Designation" value={formState.currentDesignation || ''} onChange={(event) => onPatch({ currentDesignation: event.target.value })} placeholder="Add designation" />
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">Search in <span className="font-normal text-[var(--color-text-muted)]">(designation)</span></span>
        <select
          value={formState.designationScope || 'current'}
          onChange={(event) => onPatch({ designationScope: event.target.value })}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
        >
          <option value="current">Current designation</option>
          <option value="previous">Previous designation</option>
          <option value="any">Any designation</option>
        </select>
      </label>
    </div>
  );
}
