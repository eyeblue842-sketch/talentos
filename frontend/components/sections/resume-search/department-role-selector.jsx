"use client";

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEPARTMENT_ROLE_TAXONOMY, filterDepartmentRoleTaxonomy } from '@/lib/department-role-taxonomy';

/**
 * Two-pane cascading Department -> Role selector (left: department/function,
 * right: roles within it), matching the Naukri Resdex interaction. Careeriz
 * candidate search has no department filter today - only a designation/title
 * filter - so applying a role writes it into the existing Designation field
 * as a convenience shortcut rather than a fabricated new backend filter.
 */
export function DepartmentRoleSelector({ currentDesignation, onApplyRole }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeDepartment, setActiveDepartment] = useState(DEPARTMENT_ROLE_TAXONOMY[0].department);
  const [selectedRoles, setSelectedRoles] = useState([]);

  const groups = filterDepartmentRoleTaxonomy(query);
  const activeGroup = groups.find((group) => group.department === activeDepartment) || groups[0] || null;

  function toggleRole(role) {
    setSelectedRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  function applySelection() {
    if (!selectedRoles.length) return;
    onApplyRole(selectedRoles[0]);
    setOpen(false);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--color-text)]">Department and Role</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-[2.75rem] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-2.5 text-left text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
      >
        {selectedRoles.length ? selectedRoles.join(', ') : 'Select department and role'}
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {currentDesignation ? (
        <p className="text-xs text-[var(--color-text-muted)]">Designation is already set to &ldquo;{currentDesignation}&rdquo;. Clear it below to apply a role from here.</p>
      ) : null}

      {open ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search department or role"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div role="listbox" aria-label="Department" className="max-h-64 overflow-y-auto border-r border-[var(--color-border)] pr-2">
              {groups.map((group) => (
                <button
                  key={group.department}
                  type="button"
                  role="option"
                  aria-selected={activeGroup?.department === group.department}
                  onClick={() => setActiveDepartment(group.department)}
                  className={cn(
                    'block w-full rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm',
                    activeGroup?.department === group.department
                      ? 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]',
                  )}
                >
                  {group.department}
                </button>
              ))}
            </div>
            <div role="listbox" aria-multiselectable="true" aria-label="Role" className="max-h-64 overflow-y-auto pl-1">
              {(activeGroup?.roles || []).map((role) => (
                <label key={role} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                  <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  {role}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
            <span className="text-xs text-[var(--color-text-muted)]">{selectedRoles.length > 1 ? 'Multiple roles selected - the first will be applied to Designation.' : ' '}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">Close</button>
              <button type="button" disabled={!selectedRoles.length} onClick={applySelection} className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Apply to Designation</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
