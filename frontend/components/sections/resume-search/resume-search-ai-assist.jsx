"use client";

import { useRef, useState } from 'react';
import { FileText, Paperclip, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'describe', label: 'Describe the candidate' },
  { value: 'paste', label: 'Paste job description' },
  { value: 'upload', label: 'Upload job description' },
  { value: 'job', label: 'Select existing job' },
];

const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_QUERY_CHARS = 1000;

async function requestJson(url, init = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    throw error;
  }
  return body?.data;
}

function extractFileExtension(name) {
  const match = /\.[^.]+$/.exec(name || '');
  return match ? match[0].toLowerCase() : '';
}

function buildReviewFromAiResult(payload) {
  const semanticFilters = payload?.parsedQuery?.filters || {};
  const requiredSkills = semanticFilters.requiredSkills?.length ? semanticFilters.requiredSkills : (payload?.skills || []);
  return {
    role: payload?.currentTitle || '',
    requiredSkills: [...new Set(requiredSkills)],
    optionalSkills: [...new Set(semanticFilters.optionalSkills || [])],
    minExperience: payload?.minExperience ?? '',
    maxExperience: payload?.maxExperience ?? '',
    locations: payload?.location ? [payload.location] : (semanticFilters.locations || []),
    noticePeriodDaysMax: semanticFilters.noticePeriodDaysMax ?? payload?.noticePeriodDaysMax ?? null,
    education: payload?.education || '',
  };
}

function ChipList({ items, onRemove, emptyLabel }) {
  if (!items.length) return <p className="text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onRemove(item)}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]"
        >
          {item}
          <X size={12} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/**
 * AI Resume Search Assistant - modal entry point for the recruiter Resume Search
 * criteria page. Reuses the existing intelligence provider stack via
 * /api/intelligence/search/parse (text) and /api/intelligence/search/parse-document
 * (uploaded file). Never runs a search itself - Apply to Search Filters only
 * populates the normal controls, review-and-run stays with the recruiter.
 */
export function ResumeSearchAiAssist({ jobs = [], onApply }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('describe');
  const [describeText, setDescribeText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const fileInputRef = useRef(null);

  function resetInputs() {
    setDescribeText('');
    setPasteText('');
    setUploadFile(null);
    setUploadError('');
    setSelectedJobId('');
    setError('');
    setReview(null);
  }

  function handleClose() {
    setOpen(false);
    resetInputs();
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extension = extractFileExtension(file.name);
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
      setUploadError('Upload a PDF, DOC, DOCX or TXT file.');
      setUploadFile(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('The file is larger than 8 MB. Upload a smaller job description file.');
      setUploadFile(null);
      return;
    }
    setUploadError('');
    setUploadFile(file);
  }

  async function analyseText(query) {
    const trimmed = query.trim().slice(0, MAX_QUERY_CHARS);
    return requestJson('/api/intelligence/search/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed, jobId: selectedJobId || undefined }),
    });
  }

  async function analyseUpload(file) {
    const extension = extractFileExtension(file.name);
    if (extension === '.txt') {
      const text = await file.text();
      return analyseText(text);
    }
    const formData = new FormData();
    formData.append('file', file);
    return requestJson('/api/intelligence/search/parse-document', {
      method: 'POST',
      body: formData,
    });
  }

  async function handleAnalyse() {
    setError('');
    setPending(true);
    try {
      let payload;
      if (mode === 'describe') {
        if (describeText.trim().length < 8) throw new Error('Describe the candidate in at least 8 characters.');
        payload = await analyseText(describeText);
      } else if (mode === 'paste') {
        if (pasteText.trim().length < 8) throw new Error('Paste the job description before analysing.');
        payload = await analyseText(pasteText);
      } else if (mode === 'upload') {
        if (!uploadFile) throw new Error('Upload a job description file before analysing.');
        payload = await analyseUpload(uploadFile);
      } else if (mode === 'job') {
        if (!selectedJobId) throw new Error('Select an existing job before analysing.');
        const job = jobs.find((item) => item.id === selectedJobId);
        payload = await analyseText(`Find candidates similar to the job "${job?.title || 'selected role'}".`);
      }
      setReview(buildReviewFromAiResult(payload || {}));
    } catch (caught) {
      setError(caught.message || 'Careeriz could not analyse this requirement.');
    } finally {
      setPending(false);
    }
  }

  function handleApply() {
    if (!review) return;
    onApply({
      currentDesignation: review.role || undefined,
      requiredSkills: review.requiredSkills.join(', '),
      optionalSkills: review.optionalSkills.join(', '),
      minExperience: review.minExperience === '' ? undefined : review.minExperience,
      maxExperience: review.maxExperience === '' ? undefined : review.maxExperience,
      locations: review.locations.length ? review.locations : undefined,
      noticePeriodDaysMax: review.noticePeriodDaysMax ?? undefined,
      education: review.education || undefined,
    });
    handleClose();
  }

  const canAnalyse = mode === 'describe' ? describeText.trim().length >= 8
    : mode === 'paste' ? pasteText.trim().length >= 8
      : mode === 'upload' ? Boolean(uploadFile)
        : Boolean(selectedJobId);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles size={16} aria-hidden="true" />
        AI Assist
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="AI Resume Search Assistant"
        description="Tell Careeriz what kind of candidate you are looking for."
        className="max-w-2xl"
      >
        {!review ? (
          <div className="space-y-4">
            <div role="tablist" aria-label="AI Assist input mode" className="flex flex-wrap gap-2">
              {MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === item.value}
                  onClick={() => setMode(item.value)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                    mode === item.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {mode === 'describe' ? (
              <label className="grid gap-2">
                <span className="sr-only">Describe the candidate</span>
                <textarea
                  value={describeText}
                  onChange={(event) => setDescribeText(event.target.value)}
                  placeholder='Need a Java developer with 6-10 years experience, Spring Boot, AWS, Bengaluru or Hyderabad and maximum 30 days notice.'
                  rows={5}
                  className="min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-3 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
                />
              </label>
            ) : null}

            {mode === 'paste' ? (
              <label className="grid gap-2">
                <span className="sr-only">Paste the complete Job Description</span>
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="Paste the complete Job Description"
                  rows={9}
                  className="min-h-48 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-3 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
                />
                {pasteText.trim().length > MAX_QUERY_CHARS ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Only the first {MAX_QUERY_CHARS} characters will be analysed.</p>
                ) : null}
              </label>
            ) : null}

            {mode === 'upload' ? (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="sr-only"
                  id="ai-assist-jd-upload"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="ai-assist-jd-upload"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] px-4 py-8 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
                >
                  <Paperclip size={16} aria-hidden="true" />
                  {uploadFile ? uploadFile.name : 'Choose a PDF, DOC, DOCX or TXT job description'}
                </label>
                {uploadError ? <p className="text-sm text-rose-600">{uploadError}</p> : null}
                {uploadFile ? (
                  <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-2"><FileText size={14} aria-hidden="true" />{uploadFile.name}</span>
                    <button type="button" onClick={() => setUploadFile(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]" aria-label="Remove file">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === 'job' ? (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Select an existing Job</span>
                <select
                  value={selectedJobId}
                  onChange={(event) => setSelectedJobId(event.target.value)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
                >
                  <option value="">Choose a job</option>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
                <p className="text-xs text-[var(--color-text-muted)]">Careeriz uses the job&apos;s structured data before falling back to free-text analysis.</p>
              </label>
            ) : null}

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="button" disabled={!canAnalyse || pending} loading={pending} onClick={handleAnalyse}>
                <Sparkles size={16} aria-hidden="true" />
                Analyse Requirement
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Search Criteria Found</p>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Role</span>
                <Input value={review.role} onChange={(event) => setReview((current) => ({ ...current, role: event.target.value }))} placeholder="Senior Java Developer" />
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Required Skills</span>
                <ChipList
                  items={review.requiredSkills}
                  emptyLabel="No required skills detected."
                  onRemove={(skill) => setReview((current) => ({ ...current, requiredSkills: current.requiredSkills.filter((item) => item !== skill) }))}
                />
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Optional Skills</span>
                <ChipList
                  items={review.optionalSkills}
                  emptyLabel="No optional skills detected."
                  onRemove={(skill) => setReview((current) => ({ ...current, optionalSkills: current.optionalSkills.filter((item) => item !== skill) }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Min experience (years)" type="number" value={review.minExperience} onChange={(event) => setReview((current) => ({ ...current, minExperience: event.target.value }))} />
                <Input label="Max experience (years)" type="number" value={review.maxExperience} onChange={(event) => setReview((current) => ({ ...current, maxExperience: event.target.value }))} />
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Locations</span>
                <ChipList
                  items={review.locations}
                  emptyLabel="No locations detected."
                  onRemove={(location) => setReview((current) => ({ ...current, locations: current.locations.filter((item) => item !== location) }))}
                />
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Notice Period</span>
                <select
                  value={review.noticePeriodDaysMax ?? ''}
                  onChange={(event) => setReview((current) => ({ ...current, noticePeriodDaysMax: event.target.value === '' ? null : Number(event.target.value) }))}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
                >
                  <option value="">Any</option>
                  <option value="15">0-15 days</option>
                  <option value="30">1 month</option>
                  <option value="60">2 months</option>
                  <option value="90">3 months</option>
                </select>
              </label>

              <Input
                label="Education"
                value={review.education}
                onChange={(event) => setReview((current) => ({ ...current, education: event.target.value }))}
                placeholder="Any Graduate"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="button" variant="outline" onClick={() => setReview(null)}>Analyse Again</Button>
              <Button type="button" onClick={handleApply}>
                Apply to Search Filters
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
