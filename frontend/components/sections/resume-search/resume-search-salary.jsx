"use client";

import { Input } from '@/components/ui/input';
import { FormSection } from './form-section';

export function ResumeSearchSalary({
  formState,
  onPatch,
  salaryMinAmount,
  salaryMinUnit,
  salaryMaxAmount,
  salaryMaxUnit,
  onSalaryMinChange,
  onSalaryMaxChange,
}) {
  return (
    <FormSection title="Annual Salary" description="Enter annual salary in lakh or crore. Careeriz converts this to canonical LPA for search.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Min salary</span>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
            <Input value={salaryMinAmount} onChange={(event) => onSalaryMinChange(event.target.value, salaryMinUnit)} placeholder="20" />
            <select
              value={salaryMinUnit}
              onChange={(event) => onSalaryMinChange(salaryMinAmount, event.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
            >
              <option value="LAKH_PER_ANNUM">Lakh</option>
              <option value="CRORE_PER_ANNUM">Crore</option>
            </select>
          </div>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Max salary</span>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
            <Input value={salaryMaxAmount} onChange={(event) => onSalaryMaxChange(event.target.value, salaryMaxUnit)} placeholder="1.5" />
            <select
              value={salaryMaxUnit}
              onChange={(event) => onSalaryMaxChange(salaryMaxAmount, event.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
            >
              <option value="LAKH_PER_ANNUM">Lakh</option>
              <option value="CRORE_PER_ANNUM">Crore</option>
            </select>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
