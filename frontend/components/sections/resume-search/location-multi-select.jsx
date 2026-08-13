"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Globe2, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INDIA_STATES, INDIA_DISTRICTS_BY_STATE, searchIndiaLocationTree } from '@/lib/india-location-master';
import { filterCountries } from '@/lib/country-master';

function formatDistrict(state, district) {
  return `${district}, ${state}`;
}

/**
 * Groups a flat selected-values array into display chips: a whole state
 * collapses into one chip ("Karnataka") once every one of its districts is
 * present, otherwise each selected district (and any international country)
 * gets its own chip. District values are stored "District, State" internally
 * to disambiguate same-named districts across states (e.g. Aurangabad exists
 * in both Bihar and Maharashtra) - the state suffix is display/grouping only.
 */
function groupSelections(values) {
  const remaining = new Set(values);
  const chips = [];
  for (const state of INDIA_STATES) {
    const districts = INDIA_DISTRICTS_BY_STATE[state];
    const formatted = districts.map((district) => formatDistrict(state, district));
    if (formatted.length && formatted.every((value) => remaining.has(value))) {
      chips.push({ type: 'state', label: state, values: formatted });
      formatted.forEach((value) => remaining.delete(value));
    }
  }
  for (const value of values) {
    if (remaining.has(value)) {
      chips.push({ type: 'item', label: value.includes(', ') ? value.split(', ')[0] : value, values: [value] });
      remaining.delete(value);
    }
  }
  return chips;
}

function StateNode({ state, districts, values, onChange, expanded, onToggleExpand }) {
  const formatted = districts.map((district) => formatDistrict(state, district));
  const selectedCount = formatted.filter((value) => values.includes(value)).length;
  const allSelected = selectedCount === formatted.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleState() {
    if (allSelected) {
      onChange(values.filter((value) => !formatted.includes(value)));
    } else {
      onChange([...new Set([...values, ...formatted])]);
    }
  }

  function toggleDistrict(value) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1.5 hover:bg-[var(--color-bg-muted)]">
        <button
          type="button"
          onClick={() => onToggleExpand(state)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${state}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)]"
        >
          {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
        <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
          <input ref={checkboxRef} type="checkbox" checked={allSelected} onChange={toggleState} className="h-4 w-4 accent-[var(--color-primary)]" />
          <span className={cn('font-medium', allSelected && 'text-[var(--color-primary)]')}>{state}</span>
          {selectedCount > 0 ? <span className="text-xs text-[var(--color-text-muted)]">({selectedCount}/{formatted.length})</span> : null}
        </label>
      </div>
      {expanded ? (
        <div role="group" aria-label={`${state} districts`} className="ml-6 grid grid-cols-2 gap-x-3 border-l border-[var(--color-border)] pl-3">
          {districts.map((district) => {
            const value = formatDistrict(state, district);
            return (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                <input type="checkbox" checked={values.includes(value)} onChange={() => toggleDistrict(value)} className="h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
                <span className="truncate">{district}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function LocationMultiSelect({
  label,
  placeholder = 'Search city, district or state',
  values = [],
  onChange,
  includeCountries = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedStates, setExpandedStates] = useState(() => new Set());
  const [internationalOpen, setInternationalOpen] = useState(false);
  const containerRef = useRef(null);
  const searchInputId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const treeGroups = useMemo(() => searchIndiaLocationTree(query), [query]);
  const countryMatches = includeCountries ? filterCountries(query) : [];
  const chips = useMemo(() => groupSelections(values), [values]);

  function toggleExpand(state) {
    setExpandedStates((current) => {
      const next = new Set(current);
      if (next.has(state)) next.delete(state); else next.add(state);
      return next;
    });
  }

  function removeChip(chip) {
    onChange(values.filter((value) => !chip.values.includes(value)));
  }

  function toggleCountry(name) {
    onChange(values.includes(name) ? values.filter((value) => value !== name) : [...values, name]);
  }

  const isSearching = query.trim().length > 0;

  return (
    <div className="grid gap-2" ref={containerRef}>
      {label ? <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span> : null}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border bg-[var(--color-bg-card)] px-3 py-2 text-left text-sm shadow-[var(--shadow-sm)]',
            'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
          )}
        >
          <MapPin size={15} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
          {chips.length ? (
            chips.map((chip) => (
              <span
                key={chip.label}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${chip.label}`}
                onClick={(event) => { event.stopPropagation(); removeChip(chip); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); removeChip(chip); }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]"
              >
                {chip.label}
                <X size={12} aria-hidden="true" />
              </span>
            ))
          ) : (
            <span className="text-[var(--color-text-muted)]">{placeholder}</span>
          )}
          <ChevronDown size={16} aria-hidden="true" className="ml-auto shrink-0 text-[var(--color-text-muted)]" />
        </button>

        {open ? (
          <div className="absolute z-20 mt-2 w-full min-w-[22rem] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
            <label htmlFor={searchInputId} className="sr-only">Search city, district or state</label>
            <input
              id={searchInputId}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search city, district or state"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
            />
            <div className="mt-2 max-h-80 overflow-y-auto">
              {treeGroups.length === 0 && countryMatches.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[var(--color-text-muted)]">No matching locations.</p>
              ) : null}
              {treeGroups.map((group) => (
                <StateNode
                  key={group.state}
                  state={group.state}
                  districts={group.districts}
                  values={values}
                  onChange={onChange}
                  expanded={isSearching || expandedStates.has(group.state)}
                  onToggleExpand={toggleExpand}
                />
              ))}

              {includeCountries ? (
                <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                  {isSearching ? (
                    countryMatches.length ? (
                      <div>
                        <p className="flex items-center gap-1.5 px-1 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                          <Globe2 size={12} aria-hidden="true" /> International Locations
                        </p>
                        {countryMatches.map((country) => (
                          <label key={country.code} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                            <input type="checkbox" checked={values.includes(country.name)} onChange={() => toggleCountry(country.name)} className="h-4 w-4 accent-[var(--color-primary)]" />
                            {country.name}
                          </label>
                        ))}
                      </div>
                    ) : null
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInternationalOpen((current) => !current)}
                      aria-expanded={internationalOpen}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]"
                    >
                      {internationalOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                      <Globe2 size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
                      International Locations
                    </button>
                  )}
                  {!isSearching && internationalOpen ? (
                    <div className="ml-6 grid grid-cols-2 gap-x-3 border-l border-[var(--color-border)] pl-3">
                      {filterCountries('').map((country) => (
                        <label key={country.code} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                          <input type="checkbox" checked={values.includes(country.name)} onChange={() => toggleCountry(country.name)} className="h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
                          <span className="truncate">{country.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-2 flex justify-end border-t border-[var(--color-border)] pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]">
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
