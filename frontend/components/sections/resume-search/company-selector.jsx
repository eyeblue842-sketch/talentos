"use client";

import { Input } from '@/components/ui/input';

export function CompanySelector({ formState, onPatch }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Company" value={formState.currentEmployer} onChange={(event) => onPatch({ currentEmployer: event.target.value })} placeholder="Add company name" />
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Search in <span className="font-normal text-[var(--color-text-muted)]">(company)</span></span>
          <select
            value={formState.companyScope || 'current'}
            onChange={(event) => onPatch({ companyScope: event.target.value })}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
          >
            <option value="current">Current company</option>
            <option value="previous">Previous company</option>
            <option value="any">Any company</option>
          </select>
        </label>
      </div>
      <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-primary)] marker:content-none">+ Add exclude company</summary>
        <div className="mt-3">
          <Input value={formState.previousEmployer} onChange={(event) => onPatch({ previousEmployer: event.target.value })} placeholder="Previous company name" helpText="Careeriz Resume Search does not currently support excluding a company from results - this searches previous employer instead." />
        </div>
      </details>
    </div>
  );
}
