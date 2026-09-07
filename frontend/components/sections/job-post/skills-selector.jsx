"use client";

import { useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterSkills } from '@/lib/skills-taxonomy';

const MAX_SKILLS = 30;

function normalizeSkill(value) {
  return String(value || '').trim();
}

/**
 * Naukri-style "Add Skills" selector: searchable autocomplete, multi-select
 * chips, case-insensitive duplicate prevention, and a bounded maximum. A
 * skill not present in the curated taxonomy can still be added as a custom
 * entry (matching this product's existing free-text skills behaviour - see
 * candidate-profile-form's comma-separated skills input), by pressing Enter
 * or comma when no suggestion is highlighted.
 */
export function SkillsSelector({ label = 'Add skills', value = [], onChange, name, required = false, helpText }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef(null);
  const listboxId = useId();

  const suggestions = useMemo(() => {
    const existing = new Set(value.map((item) => item.toLowerCase()));
    return filterSkills(query).filter((skill) => !existing.has(skill.toLowerCase())).slice(0, 8);
  }, [query, value]);

  const atMax = value.length >= MAX_SKILLS;

  function commitSkill(candidate) {
    const skill = normalizeSkill(candidate);
    if (!skill || atMax) return;
    const exists = value.some((item) => item.toLowerCase() === skill.toLowerCase());
    if (exists) return;
    onChange([...value, skill]);
    setQuery('');
    setHighlightIndex(-1);
  }

  function removeSkill(skill) {
    onChange(value.filter((item) => item !== skill));
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        commitSkill(suggestions[highlightIndex]);
      } else {
        commitSkill(query);
      }
      return;
    }
    if (event.key === 'Backspace' && !query && value.length) {
      removeSkill(value[value.length - 1]);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="grid min-w-0 max-w-full gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{value.length}/{MAX_SKILLS} added</span>
      </div>
      {name ? <input type="hidden" name={name} value={value.join(', ')} /> : null}
      <div className="relative min-w-0 max-w-full">
        <div className="flex min-h-[2.75rem] w-full min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2.5 py-2 shadow-[var(--shadow-sm)] focus-within:border-[var(--color-primary)] focus-within:ring-4 focus-within:ring-[color:rgba(79,156,249,0.22)]">
          {value.map((skill) => (
            <span
              key={skill}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]"
            >
              <span className="truncate">{skill}</span>
              <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} className="shrink-0">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className="min-w-[8rem] flex-1 border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
            value={query}
            disabled={atMax}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setHighlightIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              commitSkill(query);
              setTimeout(() => setOpen(false), 100);
            }}
            onKeyDown={handleKeyDown}
            placeholder={atMax ? 'Maximum skills reached' : value.length ? 'Add another skill' : 'e.g. Java, Spring Boot, AWS'}
          />
        </div>
        {open && suggestions.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Skill suggestions"
            className="absolute z-20 mt-1.5 w-full min-w-[16rem] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-lg)]"
          >
            {suggestions.map((skill, index) => (
              <li key={skill} role="option" aria-selected={index === highlightIndex}>
                <button
                  type="button"
                  className={cn(
                    'block w-full truncate px-3.5 py-2 text-left text-sm text-[var(--color-text)]',
                    index === highlightIndex ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'hover:bg-[var(--color-bg-muted)]',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitSkill(skill)}
                >
                  {skill}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        {helpText || `Search and select from the Careeriz skills list, or type a custom skill and press Enter. Duplicate skills (any case) are ignored. Up to ${MAX_SKILLS} skills.`}
      </p>
    </div>
  );
}
