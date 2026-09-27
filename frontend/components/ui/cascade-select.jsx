"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Generic grouped cascade picker - the single primitive behind the recruiter
 * Job/Resume "Industry", "Department -> Role" and "Education -> Degree ->
 * Specialisation" fields (the pattern Naukri repeats across its posting flow).
 *
 * `options` is a tree of nodes: { label, value?, children? }.
 *   - A node WITH `children` is a branch: clicking it opens the next column.
 *   - A node WITH `value` and no `children` is a selectable leaf.
 * Depth is arbitrary (miller-columns), so the same component serves the flat
 * industry list, the 2-level department->role list, and the 3-level education
 * level->category->course list without per-field UI.
 *
 * Single-select (`multiple={false}`, default): `value` is a string, `onChange`
 * receives the selected leaf value (or null when cleared).
 * Multi-select (`multiple`): `value` is a string[], `onChange` receives the
 * next string[]. Selected leaves render as removable chips in the trigger.
 *
 * When `name` is set a hidden input is rendered for plain form posting:
 * single -> the value; multiple -> comma-joined values. Consumers that need a
 * different serialisation (e.g. JSON) should omit `name` and post their own.
 */
export function CascadeSelect({
  label,
  name,
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = 'Select an option',
  helpText,
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [path, setPath] = useState([]); // indices of expanded branches, per column
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const generatedId = useId();
  const inputId = `cascade-${generatedId}`;

  const selectedValues = useMemo(
    () => (multiple ? (Array.isArray(value) ? value : []) : value ? [value] : []),
    [multiple, value],
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    function handleClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setPath([]);
      // Focus the search box so keyboard users land in a typeable control.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const leaves = useMemo(() => flattenLeaves(options), [options]);
  const selectedTrails = useMemo(
    () => selectedValues.map((val) => leaves.find((leaf) => leaf.value === val)).filter(Boolean),
    [leaves, selectedValues],
  );

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return leaves.filter(
      (leaf) => leaf.label.toLowerCase().includes(needle)
        || leaf.trail.some((crumb) => crumb.toLowerCase().includes(needle)),
    );
  }, [leaves, query]);

  // Columns rendered when not searching: root, then each expanded branch's children.
  const columns = useMemo(() => {
    const cols = [options];
    let level = options;
    for (const index of path) {
      const node = level[index];
      if (node?.children?.length) {
        cols.push(node.children);
        level = node.children;
      } else {
        break;
      }
    }
    return cols;
  }, [options, path]);

  function isSelected(val) {
    return selectedValues.includes(val);
  }

  function selectLeaf(val) {
    if (multiple) {
      const next = isSelected(val)
        ? selectedValues.filter((existing) => existing !== val)
        : [...selectedValues, val];
      onChange(next);
    } else {
      onChange(val);
      setOpen(false);
    }
  }

  function handleBranchClick(columnIndex, nodeIndex) {
    setPath((current) => [...current.slice(0, columnIndex), nodeIndex]);
  }

  function clearAll(event) {
    event.stopPropagation();
    onChange(multiple ? [] : null);
  }

  const hasSelection = selectedValues.length > 0;

  return (
    <div className="grid min-w-0 max-w-full gap-2.5" ref={containerRef}>
      {label ? (
        <label htmlFor={inputId} className="truncate text-sm font-semibold text-[var(--color-text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
        </label>
      ) : null}

      <div className="relative min-w-0">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((current) => !current)}
          className={cn(
            'flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-bg-card)] px-3.5 py-2.5 text-left text-sm shadow-[var(--shadow-sm)]',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
            open ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
            disabled ? 'cursor-not-allowed bg-[var(--color-bg-muted)] text-[var(--color-text-disabled)]' : '',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {!hasSelection ? (
              <span className="text-[var(--color-text-muted)]">{placeholder}</span>
            ) : multiple ? (
              selectedTrails.map((leaf) => (
                <span key={leaf.value} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                  <span className="truncate">{leaf.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${leaf.label}`}
                    onClick={(event) => { event.stopPropagation(); selectLeaf(leaf.value); }}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectLeaf(leaf.value); } }}
                    className="shrink-0 cursor-pointer"
                  >
                    <X size={12} aria-hidden="true" />
                  </span>
                </span>
              ))
            ) : (
              <span className="truncate text-[var(--color-text)]">{selectedTrails[0]?.label || value}</span>
            )}
          </span>
          {hasSelection && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={clearAll}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); clearAll(event); } }}
              className="shrink-0 cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X size={15} aria-hidden="true" />
            </span>
          ) : null}
          <ChevronDown size={16} aria-hidden="true" className={cn('pointer-events-none shrink-0 text-[var(--color-text-muted)] transition-transform', open ? 'rotate-180' : '')} />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label={label || placeholder}
            className="absolute left-0 top-full z-50 mt-1 w-max max-w-[min(90vw,42rem)] rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white p-1 shadow-lg"
            onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); } }}
          >
            <div className="p-1.5">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            {searchResults ? (
              <div className="max-h-72 min-w-[16rem] overflow-y-auto">
                {searchResults.length ? searchResults.map((leaf) => (
                  <button
                    key={leaf.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected(leaf.value)}
                    onClick={() => selectLeaf(leaf.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm',
                      isSelected(leaf.value) ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{leaf.label}</span>
                      {leaf.trail.length ? <span className="block truncate text-xs text-[var(--color-text-muted)]">{leaf.trail.join(' / ')}</span> : null}
                    </span>
                    {isSelected(leaf.value) ? <Check size={16} aria-hidden="true" className="shrink-0" /> : null}
                  </button>
                )) : <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">No matching options</p>}
              </div>
            ) : (
              <div className="flex max-h-72 overflow-x-auto">
                {columns.map((nodes, columnIndex) => (
                  <ul key={columnIndex} className={cn('min-w-[13rem] overflow-y-auto py-0.5', columnIndex > 0 ? 'border-l border-[var(--color-border)]' : '')}>
                    {nodes.map((node, nodeIndex) => {
                      const isBranch = Array.isArray(node.children) && node.children.length > 0;
                      const active = path[columnIndex] === nodeIndex;
                      const selected = !isBranch && isSelected(node.value);
                      return (
                        <li key={node.value || node.label}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => (isBranch ? handleBranchClick(columnIndex, nodeIndex) : selectLeaf(node.value))}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm',
                              selected ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                                : active ? 'bg-[var(--color-bg-muted)] text-[var(--color-text)]'
                                  : 'text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]',
                            )}
                          >
                            <span className="min-w-0 truncate">{node.label}</span>
                            {isBranch ? <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
                              : selected ? <Check size={15} aria-hidden="true" className="shrink-0" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {name ? <input type="hidden" name={name} value={multiple ? selectedValues.join(', ') : (value || '')} /> : null}
      {helpText ? <p className="text-sm text-[var(--color-text-muted)]">{helpText}</p> : null}
    </div>
  );
}

/** Depth-first flatten to selectable leaves, each carrying its ancestor labels. */
function flattenLeaves(nodes, trail = []) {
  const result = [];
  for (const node of nodes || []) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      result.push(...flattenLeaves(node.children, [...trail, node.label]));
    } else if (node.value != null) {
      result.push({ label: node.label, value: node.value, trail });
    }
  }
  return result;
}

/** Normalise a flat string list into leaf nodes: ['A','B'] -> [{label,value}]. */
export function toCascadeOptions(values) {
  return (values || []).map((item) => (typeof item === 'string' ? { label: item, value: item } : item));
}
