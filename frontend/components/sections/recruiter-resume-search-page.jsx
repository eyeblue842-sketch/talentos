"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  applyHistoryToState,
  applySavedSearchToState,
  buildSemanticSearchPayload,
  buildSemanticSearchUrlParams,
  hasSearchInputs,
  mapSemanticSearchError,
  parseSavedCandidateSearchList,
  parseSemanticSearchHistoryResponse,
} from '@/lib/semantic-search';
import { deriveCtcEditorValue, normalizeCtcToLpa } from '@/lib/ctc';
import { ResumeSearchAiAssist } from './resume-search/resume-search-ai-assist';
import { ResumeSearchKeywords } from './resume-search/resume-search-keywords';
import { ResumeSearchExperience } from './resume-search/resume-search-experience';
import { ResumeSearchLocation } from './resume-search/resume-search-location';
import { ResumeSearchSalary } from './resume-search/resume-search-salary';
import { ResumeSearchEmployment } from './resume-search/resume-search-employment';
import { ResumeSearchNoticePeriod } from './resume-search/resume-search-notice-period';
import { ResumeSearchEducation } from './resume-search/resume-search-education';
import { ResumeSearchDiversity } from './resume-search/resume-search-diversity';
import { ResumeSearchAdditionalDetails } from './resume-search/resume-search-additional-details';
import { ResumeSearchActionBar } from './resume-search/resume-search-action-bar';
import { ResumeSearchRail } from './resume-search/resume-search-rail';

const HISTORY_PAGE_SIZE = 8;

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    throw error;
  }
  return body?.data;
}

function SaveSearchDialog({ open, onClose, onSave, pending }) {
  // Dialog unmounts its children whenever `open` is false, so this state
  // naturally resets to '' on every reopen without needing an effect.
  const [name, setName] = useState('');

  return (
    <Dialog open={open} onClose={onClose} title="Save recruiter search" description="Saved searches preserve the structured filters on this page for reuse.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name);
        }}
      >
        <Input label="Search name" value={name} onChange={(event) => setName(event.target.value)} required />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" loading={pending}>Save search</Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * One continuous recruiter Resume Search form for /recruiter/database.
 * Owns the single formState/onPatch contract every child section reads and
 * writes - no child holds its own copy of search filter state. Search
 * execution never happens here: "Search candidates" always navigates to
 * /recruiter/database/results, which continues to run the existing
 * candidateSearchOrchestrator-backed search unchanged.
 */
export function RecruiterResumeSearchPage({
  initialState,
  jobs = [],
  featureEnabled,
  canRead,
  canExecute,
  canReadHistory,
  canReadSavedSearches,
  canManageSavedSearches,
  searchHistoryEnabled,
  savedSearchesEnabled,
}) {
  const router = useRouter();
  const { push } = useToast();

  const [formState, setFormState] = useState(initialState);
  const [savedSearches, setSavedSearches] = useState([]);
  const [history, setHistory] = useState({ items: [] });
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const initialSalaryMinEditor = useMemo(() => deriveCtcEditorValue(initialState.salaryMin), [initialState.salaryMin]);
  const initialSalaryMaxEditor = useMemo(() => deriveCtcEditorValue(initialState.salaryMax), [initialState.salaryMax]);
  const [salaryMinAmount, setSalaryMinAmount] = useState(initialSalaryMinEditor.amount);
  const [salaryMinUnit, setSalaryMinUnit] = useState(initialSalaryMinEditor.unit);
  const [salaryMaxAmount, setSalaryMaxAmount] = useState(initialSalaryMaxEditor.amount);
  const [salaryMaxUnit, setSalaryMaxUnit] = useState(initialSalaryMaxEditor.unit);

  function syncSalaryEditors(nextState) {
    const minEditor = deriveCtcEditorValue(nextState.salaryMin);
    const maxEditor = deriveCtcEditorValue(nextState.salaryMax);
    setSalaryMinAmount(minEditor.amount);
    setSalaryMinUnit(minEditor.unit);
    setSalaryMaxAmount(maxEditor.amount);
    setSalaryMaxUnit(maxEditor.unit);
  }

  function patch(partial) {
    setFormState((current) => ({ ...current, ...partial, deferSearch: false }));
  }

  useEffect(() => {
    if (savedSearchesEnabled && canReadSavedSearches) {
      requestJson('/api/intelligence/saved-searches')
        .then((payload) => setSavedSearches(parseSavedCandidateSearchList(payload)))
        .catch(() => {});
    }
    if (searchHistoryEnabled && canReadHistory) {
      requestJson(`/api/intelligence/search/history?page=1&pageSize=${HISTORY_PAGE_SIZE}`)
        .then((payload) => setHistory(parseSemanticSearchHistoryResponse(payload)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigateWith(nextState) {
    if (!hasSearchInputs(nextState)) {
      push({ tone: 'warning', title: 'Add a search criterion', description: 'Add at least one search criterion before searching.' });
      return;
    }
    const params = buildSemanticSearchUrlParams(nextState);
    router.push(`/recruiter/database/results?${params.toString()}`);
  }

  function handleSearch() {
    navigateWith(formState);
  }

  function handleFillRecent(entry) {
    const nextState = applyHistoryToState(entry, formState);
    setFormState(nextState);
    syncSalaryEditors(nextState);
    push({ tone: 'success', title: 'Recent search loaded', description: 'Review the criteria before searching.' });
  }

  function handleExecuteRecent(entry) {
    const nextState = applyHistoryToState(entry, formState);
    setFormState(nextState);
    navigateWith(nextState);
  }

  function handleFillSaved(entry) {
    const nextState = applySavedSearchToState(entry, formState);
    setFormState(nextState);
    syncSalaryEditors(nextState);
    push({ tone: 'success', title: 'Saved search loaded', description: `${entry.name} is ready for review.` });
  }

  async function handleSaveCurrent(name) {
    const payload = buildSemanticSearchPayload(formState, 1, 12);
    setSavePending(true);
    try {
      await requestJson('/api/intelligence/saved-searches', {
        method: 'POST',
        body: JSON.stringify({
          name,
          rawQuery: payload.query,
          searchMode: payload.mode,
          filtersJson: payload.filters || {},
          jobContextId: payload.jobId || undefined,
          isShared: false,
        }),
      });
      setSaveDialogOpen(false);
      const refreshed = await requestJson('/api/intelligence/saved-searches');
      setSavedSearches(parseSavedCandidateSearchList(refreshed));
      push({ tone: 'success', title: 'Search saved', description: `${name} is now available in Saved Searches.` });
    } catch (caught) {
      push({ tone: 'error', title: 'Unable to save search', description: mapSemanticSearchError(caught) });
    } finally {
      setSavePending(false);
    }
  }

  function handleClear() {
    const cleared = { ...initialState, deferSearch: false, query: '', jobId: '', candidateName: '', industries: [] };
    setFormState(cleared);
    syncSalaryEditors(cleared);
  }

  if (!featureEnabled) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="Resume Search is disabled" description="The recruiter resume search workspace is hidden in this environment because the feature flag is turned off." />
      </Card>
    );
  }

  if (!canRead) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="You do not have access to Resume Search" description="A recruiter with resume search permissions can search the candidate database here." />
      </Card>
    );
  }

  return (
    <div className="flex w-full items-start gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">Search Candidates</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Search the Careeriz resume database using structured recruiter filters and AI-assisted search.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleClear} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <X size={13} aria-hidden="true" />
              Clear all
            </button>
            <ResumeSearchAiAssist jobs={jobs} onApply={patch} />
          </div>
        </div>

        <div className="mt-5 space-y-5 border-t border-[var(--color-border)] pt-5">
          <ResumeSearchKeywords formState={formState} onPatch={patch} />
          <ResumeSearchExperience formState={formState} onPatch={patch} />
          <ResumeSearchLocation formState={formState} onPatch={patch} />
          <ResumeSearchSalary
            formState={formState}
            onPatch={patch}
            salaryMinAmount={salaryMinAmount}
            salaryMinUnit={salaryMinUnit}
            salaryMaxAmount={salaryMaxAmount}
            salaryMaxUnit={salaryMaxUnit}
            onSalaryMinChange={(amount, unit) => {
              setSalaryMinAmount(amount);
              setSalaryMinUnit(unit);
              patch({ salaryMin: normalizeCtcToLpa(amount, unit) ?? '' });
            }}
            onSalaryMaxChange={(amount, unit) => {
              setSalaryMaxAmount(amount);
              setSalaryMaxUnit(unit);
              patch({ salaryMax: normalizeCtcToLpa(amount, unit) ?? '' });
            }}
          />
          <ResumeSearchEmployment formState={formState} onPatch={patch} />
          <ResumeSearchNoticePeriod formState={formState} onPatch={patch} />
          <ResumeSearchEducation formState={formState} onPatch={patch} />
          <ResumeSearchDiversity />
          <ResumeSearchAdditionalDetails formState={formState} onPatch={patch} />
        </div>

        <ResumeSearchActionBar
          activeWithin={formState.activeWithin}
          onActiveWithinChange={(value) => patch({ activeWithin: value === '' ? '' : Number(value) })}
          onSearch={handleSearch}
          disabled={!canExecute}
        />
      </div>

      <div className="sticky top-6 shrink-0">
        <ResumeSearchRail
          recentItems={history.items || []}
          onFillRecent={handleFillRecent}
          onExecuteRecent={handleExecuteRecent}
          savedItems={savedSearches}
          onFillSaved={handleFillSaved}
          canManageSaved={Boolean(savedSearchesEnabled && canManageSavedSearches)}
          hasCriteria={hasSearchInputs(formState)}
          onSaveCurrent={() => setSaveDialogOpen(true)}
        />
      </div>

      <SaveSearchDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} onSave={handleSaveCurrent} pending={savePending} />
    </div>
  );
}
