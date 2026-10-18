'use client';

import { useEffect, useState } from 'react';
import { Plus, Star, WandSparkles, X } from 'lucide-react';
import { parseSemanticSearchSuggestionsResponse } from '@/lib/semantic-search';

export function splitKeywordList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

async function fetchKeywordSuggestions(query) {
  const response = await fetch('/api/intelligence/search/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 10 }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) return [];
  return parseSemanticSearchSuggestionsResponse(body?.data).suggestions || [];
}

// Naukri-style keyword input: each keyword is a chip with a star. Filled star =
// mandatory (required skill); outline star = optional. Click the star to toggle.
// AI-suggested keywords load automatically from the current keywords/query and
// are one-click to add. Self-contained: maps onto the comma-separated
// requiredSkills / optionalSkills strings and fetches its own suggestions.
export function KeywordStarChips({ requiredSkills, optionalSkills, onChange, query = '', suggestionsEnabled = true }) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const required = splitKeywordList(requiredSkills);
  const optional = splitKeywordList(optionalSkills);
  const chips = [
    ...required.map((term) => ({ term, mandatory: true })),
    ...optional.map((term) => ({ term, mandatory: false })),
  ];
  const exists = (term) => chips.some((chip) => chip.term.toLowerCase() === term.toLowerCase());
  const commit = (nextRequired, nextOptional) => onChange(nextRequired.join(', '), nextOptional.join(', '));

  const addKeyword = (rawTerm) => {
    const term = String(rawTerm || '').trim();
    setDraft('');
    if (!term || exists(term)) return;
    commit(required, [...optional, term]);
  };
  const removeKeyword = (term) => commit(required.filter((item) => item !== term), optional.filter((item) => item !== term));
  const toggleMandatory = (term) => {
    if (required.includes(term)) commit(required.filter((item) => item !== term), [...optional, term]);
    else commit([...required, term], optional.filter((item) => item !== term));
  };

  const suggestionBase = [...required, ...optional, query].filter(Boolean).join(' ').trim();
  useEffect(() => {
    if (!suggestionsEnabled || !suggestionBase) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchKeywordSuggestions(suggestionBase)
        .then((items) => { if (active) setSuggestions(items); })
        .catch(() => { if (active) setSuggestions([]); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [suggestionBase, suggestionsEnabled]);

  const queryTermSet = new Set(String(query || '').split(/[\s,]+/).map((term) => term.trim().toLowerCase()).filter(Boolean));
  const suggestionChips = (suggestions || [])
    .map((item) => (typeof item === 'string' ? item : item.text))
    .filter((text) => text && !exists(text) && !queryTermSet.has(text.toLowerCase()))
    .slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-2 focus-within:border-[var(--color-primary)]">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.term}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${chip.mandatory ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]'}`}
            >
              <button
                type="button"
                aria-label={chip.mandatory ? `Make ${chip.term} optional` : `Make ${chip.term} mandatory`}
                title={chip.mandatory ? 'Mandatory — click to make optional' : 'Optional — click to make mandatory'}
                onClick={() => toggleMandatory(chip.term)}
                className={`leading-none ${chip.mandatory ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
              >
                <Star size={14} fill={chip.mandatory ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              {chip.term}
              <button type="button" aria-label={`Remove ${chip.term}`} onClick={() => removeKeyword(chip.term)} className="leading-none hover:opacity-70">
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addKeyword(draft); }
              else if (event.key === 'Backspace' && !draft && chips.length) { removeKeyword(chips[chips.length - 1].term); }
            }}
            onBlur={() => { if (draft.trim()) addKeyword(draft); }}
            placeholder={chips.length ? 'Type another keyword' : 'Type a skill or keyword, then press Enter'}
            className="min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-[var(--color-text)] outline-none"
          />
        </div>
      </div>
      <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
        <Star size={12} fill="currentColor" aria-hidden="true" className="text-[var(--color-primary)]" /> mandatory
        <Star size={12} aria-hidden="true" className="ml-2" /> optional — click a star to toggle
        {chips.length ? <button type="button" className="ml-auto font-semibold text-[var(--color-primary)]" onClick={() => commit([], [])}>Clear all</button> : null}
      </p>
      {suggestionsEnabled && suggestionBase && (suggestionChips.length || loading) ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"><WandSparkles size={14} aria-hidden="true" /> AI suggested keywords</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestionChips.length ? suggestionChips.map((text) => (
              <button key={text} type="button" onClick={() => addKeyword(text)} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                <Plus size={12} aria-hidden="true" /> {text}
              </button>
            )) : <p className="text-xs text-[var(--color-text-muted)]">Finding suggestions…</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
