"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

function toQueryString(parsed, jobId, requisitionId) {
  const semantic = parsed?.parsedQuery || {};
  const semanticFilters = semantic?.filters || {};
  const params = new URLSearchParams();
  params.set('reviewFilters', 'true');
  if (jobId) params.set('jobId', jobId);
  if (requisitionId) params.set('requisitionId', requisitionId);
  if (semantic.mode) params.set('mode', semantic.mode);
  if (semantic.originalQuery || parsed.keyword || parsed.query) params.set('q', semantic.originalQuery || parsed.keyword || parsed.query);
  if (parsed.location) params.set('location', parsed.location);
  if (parsed.minExperience != null) params.set('minExperience', String(parsed.minExperience));
  if (parsed.maxExperience != null) params.set('maxExperience', String(parsed.maxExperience));
  if (parsed.currentTitle) params.set('candidateName', parsed.currentTitle);
  if (parsed.education) params.set('education', parsed.education);
  const requiredSkills = semanticFilters.requiredSkills?.length
    ? semanticFilters.requiredSkills
    : parsed.skills || [];
  if (requiredSkills.length) params.set('requiredSkills', requiredSkills.join(', '));
  if (semanticFilters.optionalSkills?.length) params.set('optionalSkills', semanticFilters.optionalSkills.join(', '));
  return params.toString();
}

export function RecruiterTalentSearchAssistant({ jobId = '', requisitionId = '' }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    setError('');
    setResult(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/intelligence/search/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, jobId, requisitionId }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.message || 'Unable to interpret this search query.');
        }
        setResult(body.data);
      } catch (caught) {
        setError(caught.message);
      }
    });
  }

  function applyFilters() {
    if (!result) return;
    const qs = toQueryString(result, jobId, requisitionId);
    router.push(`/recruiter/database${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-3">
        <span className="rounded-[16px] bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">AI Assist</p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">Describe the candidate you are looking for. Careeriz will interpret the request, populate recruiter filters, and wait for your review before running search.</p>
        </div>
      </div>

      <textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a Java developer in Bengaluru with Spring Boot and AWS, 6-10 years experience and maximum 30 days notice."
        className="mt-4 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
      />

      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" onClick={handleGenerate} disabled={pending || query.trim().length < 8}>
          <Sparkles size={16} aria-hidden="true" />
          {pending ? 'Interpreting...' : 'Search with AI'}
        </Button>
        {result ? (
          <Button type="button" variant="outline" onClick={applyFilters}>
            Review filters
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Interpreted filters</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(result.interpretedFilters || []).map((item) => (
              <span key={item} className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {item}
              </span>
            ))}
            {!result.interpretedFilters?.length ? <span className="text-sm text-[var(--color-text-muted)]">No structured filters detected yet.</span> : null}
          </div>
          {result.warnings?.length ? (
            <div className="mt-3 space-y-1">
              {result.warnings.map((warning) => <p key={warning} className="text-sm text-[var(--color-text-secondary)]">{warning}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
