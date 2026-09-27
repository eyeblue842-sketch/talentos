"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineValidationMessage } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { ResumeImportStatusBadge } from '@/components/resume-import/status-badge';
import { cn } from '@/lib/utils';
import {
  calculateBatchProgress,
  extractParsedCandidateFields,
  formatConfidence,
  formatDuration,
  formatResumeImportSupportReference,
  getResumeImportErrorMessage,
  hasMinimumIdentityFields,
  RESUME_IMPORT_ACCEPT_ATTRIBUTE,
  RESUME_IMPORT_DUPLICATE_RESOLUTIONS,
  RESUME_IMPORT_TERMINAL_BATCH_STATUSES,
  SUPPORTED_RESUME_IMPORT_EXTENSIONS,
} from '@/lib/resume-import';

function formatDateTime(value) {
  if (!value) return 'Not available';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(value));
  } catch {
    return 'Not available';
  }
}

function fileExtension(name = '') {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function joinSkills(skills = []) {
  return Array.isArray(skills) ? skills.join(', ') : '';
}

function splitSkills(value = '') {
  // Drop empties and over-long fragments (the parser sometimes spills whole
  // sentences into "skills"); the confirm schema caps each skill at 80 chars
  // and the list at 100, and rejects the entire submission otherwise.
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length >= 1 && item.length <= 80)
    .slice(0, 100);
}

// Experience is stored as a whole number; AI parsers emit fractional years
// (e.g. 7.3), which the confirm schema rejects. Round to the nearest integer.
function normalizeExperienceYears(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function buildQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({ success: false, message: 'Unable to parse response.' }));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    error.details = body?.details;
    error.code = body?.code || body?.details?.code || null;
    throw error;
  }

  return body;
}

async function downloadFromApi(url, fallbackFilename) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body?.message || 'Download failed.');
    error.statusCode = response.status;
    error.code = body?.code || null;
    throw error;
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function UploadRow({ file, onRemove }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{file.file.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{file.extension.toUpperCase().replace('.', '')} | {formatSize(file.file.size)}</p>
        {file.error ? (
          <InlineValidationMessage>{file.error}</InlineValidationMessage>
        ) : (
          <p className="text-xs text-emerald-700">Ready for upload</p>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(file.id)} aria-label={`Remove ${file.file.name}`}>
        <Trash2 size={16} aria-hidden="true" />
        Remove
      </Button>
    </div>
  );
}

function SummaryCard({ label, value, helper }) {
  return <StatCard label={label} value={value} helper={helper} />;
}

function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmTone = 'primary',
  onConfirm,
  pending = false,
  children = null,
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      {children}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button type="button" variant={confirmTone} onClick={onConfirm} loading={pending}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

function usePagePolling({ enabled, intervalMs = 5000, onPoll }) {
  const pollingRef = useRef({ timer: null, running: false });

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const schedule = (delay) => {
      pollingRef.current.timer = window.setTimeout(async () => {
        if (cancelled || pollingRef.current.running) {
          schedule(intervalMs);
          return;
        }

        if (typeof document !== 'undefined' && document.hidden) {
          schedule(Math.max(intervalMs, 10000));
          return;
        }

        pollingRef.current.running = true;
        try {
          await onPoll();
        } finally {
          pollingRef.current.running = false;
          if (!cancelled) schedule(intervalMs);
        }
      }, delay);
    };

    schedule(intervalMs);
    return () => {
      cancelled = true;
      if (pollingRef.current.timer) {
        window.clearTimeout(pollingRef.current.timer);
      }
    };
  }, [enabled, intervalMs, onPoll]);
}

export function ResumeImportUploadExperience({
  limits,
  batchHrefPrefix,
  historyHref,
}) {
  const router = useRouter();
  const { push } = useToast();
  const inputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [errorSummary, setErrorSummary] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  const totals = useMemo(() => ({
    count: selectedFiles.length,
    bytes: selectedFiles.reduce((sum, item) => sum + item.file.size, 0),
    valid: selectedFiles.every((item) => !item.error),
  }), [selectedFiles]);

  function validateFileSelection(files) {
    const nextErrors = [];
    const normalized = Array.from(files).map((file, index) => {
      const extension = fileExtension(file.name);
      let error = '';

      if (!SUPPORTED_RESUME_IMPORT_EXTENSIONS.includes(extension)) {
        error = 'Unsupported extension. Use PDF, DOC, DOCX, or ZIP.';
      } else if (file.size === 0) {
        error = 'Empty files cannot be uploaded.';
      } else if (file.size > limits.maxFileSizeBytes && extension !== '.zip') {
        error = `File exceeds the ${limits.maxFileSizeMb} MB limit.`;
      } else if (extension === '.zip' && file.size > limits.maxZipSizeBytes) {
        error = `ZIP exceeds the ${limits.maxZipSizeMb} MB limit.`;
      }

      return {
        id: `${file.name}-${file.size}-${index}`,
        file,
        extension,
        error,
      };
    });

    if (normalized.length > limits.maxFiles) {
      nextErrors.push(`You can upload up to ${limits.maxFiles} resumes in one batch.`);
    }

    const zipCount = normalized.filter((item) => item.extension === '.zip').length;
    if (zipCount > 1) {
      nextErrors.push('Upload only one ZIP archive at a time.');
    }
    if (zipCount === 1 && normalized.length > 1) {
      nextErrors.push('Upload either one ZIP file or individual resumes, not both together.');
    }

    const seen = new Set();
    const deduped = normalized.map((item) => {
      const key = `${item.file.name.toLowerCase()}:${item.file.size}`;
      if (seen.has(key)) {
        return { ...item, error: item.error || 'Duplicate file selected.' };
      }
      seen.add(key);
      return item;
    });

    return { files: deduped, errors: nextErrors };
  }

  function applySelectedFiles(fileList) {
    const { files, errors } = validateFileSelection(fileList);
    setSelectedFiles(files);
    setErrorSummary(errors);
    setResultSummary(null);
  }

  function handleFileChange(event) {
    applySelectedFiles(event.target.files || []);
  }

  function removeFile(id) {
    setSelectedFiles((current) => current.filter((item) => item.id !== id));
  }

  function clearAll() {
    setSelectedFiles([]);
    setErrorSummary([]);
    setResultSummary(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // Poll the background parse job until it finishes, so the recruiter only ever
  // sees a single "uploaded / parsed" summary instead of the batch machinery.
  async function waitForParsingToComplete(batchId) {
    const terminalStatuses = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);
    const deadline = Date.now() + 5 * 60 * 1000;
    let latest = null;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`/api/resume-imports/${batchId}`, { cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        latest = body?.data || latest;
        const processedAll = latest && latest.totalItemCount != null
          && latest.processedCount != null
          && latest.processedCount >= latest.totalItemCount;
        if (latest && (terminalStatuses.has(latest.status) || processedAll)) {
          return latest;
        }
      } catch {
        // transient error — keep polling until the deadline
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    return latest;
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function handleDrop(event) {
    event.preventDefault();
    if (uploading) return;
    applySelectedFiles(event.dataTransfer.files || []);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function uploadWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/resume-imports');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onerror = () => reject(new Error('Network interruption prevented the upload from completing.'));
      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}');
          if (xhr.status < 200 || xhr.status >= 300 || payload?.success === false) {
            const error = new Error(payload?.message || 'Upload failed.');
            error.code = payload?.code || null;
            reject(error);
            return;
          }
          resolve(payload);
        } catch {
          reject(new Error('The upload response could not be read.'));
        }
      };
      xhr.send(formData);
    });
  }

  async function submitUpload() {
    if (!selectedFiles.length) {
      setErrorSummary(['Select one or more resumes before uploading.']);
      return;
    }
    if (selectedFiles.some((item) => item.error) || errorSummary.length) {
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((item) => formData.append('files', item.file));

    const uploadedCount = selectedFiles.length;
    setUploading(true);
    setUploadProgress(0);
    setResultSummary(null);
    try {
      const payload = await uploadWithProgress(formData);
      const batchId = payload?.data?.id;
      setUploading(false);
      setProcessing(true);
      const finalBatch = batchId ? await waitForParsingToComplete(batchId) : null;

      const parsed = finalBatch?.successCount ?? 0;
      const review = finalBatch?.reviewCount ?? 0;
      const duplicates = finalBatch?.duplicateCount ?? 0;
      const failed = finalBatch?.failedCount ?? 0;
      const total = finalBatch?.originalFileCount ?? finalBatch?.totalItemCount ?? uploadedCount;
      setResultSummary({ total, parsed, review, duplicates, failed, settled: Boolean(finalBatch) });

      // Clear the picker so the next upload starts clean.
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    } catch (error) {
      const message = getResumeImportErrorMessage(error.code, error.message);
      setErrorSummary([message]);
      push({
        tone: 'error',
        title: 'Upload failed',
        description: message,
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Supported files" value="PDF, DOC, DOCX, ZIP" helper="Upload multiple resumes or one ZIP archive" />
        <SummaryCard label="Maximum files" value={limits.maxFiles} helper="Per batch" />
        <SummaryCard label="File size limit" value={`${limits.maxFileSizeMb} MB`} helper="Per PDF, DOC, or DOCX file" />
        <SummaryCard label="ZIP limit" value={`${limits.maxZipSizeMb} MB`} helper="Archive size before expansion" />
      </div>

      <Card>
        <div
          role="button"
          tabIndex={0}
          aria-label="Bulk resume upload drop zone"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="grid cursor-pointer justify-items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-muted)] px-6 py-10 text-center transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
        >
          <div className="rounded-full bg-white p-3 text-[var(--color-primary)] shadow-[var(--shadow-sm)]">
            <Upload size={22} aria-hidden="true" />
          </div>
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Upload &amp; Parse Resumes</h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Drag and drop multiple PDF, DOC, or DOCX resumes, or upload one ZIP archive containing supported resume files.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" variant="primary" onClick={openPicker}>
              <Upload size={16} aria-hidden="true" />
              Choose files
            </Button>
            <Button type="button" variant="outline" as="a" href={historyHref}>
              View import history
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={RESUME_IMPORT_ACCEPT_ATTRIBUTE}
            multiple
            className="sr-only"
            aria-label="Choose resume files"
            onChange={handleFileChange}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {totals.count} file{totals.count === 1 ? '' : 's'} selected | {formatSize(totals.bytes)} total
            </p>
            {errorSummary.length ? (
              <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" aria-live="polite">
                <p className="font-semibold">Review the selected files</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {errorSummary.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={clearAll} disabled={uploading || !selectedFiles.length}>
              Clear all
            </Button>
            <Button type="button" onClick={submitUpload} loading={uploading} disabled={!selectedFiles.length || !totals.valid || errorSummary.length > 0}>
              Upload &amp; Parse Resumes
            </Button>
          </div>
        </div>

        {uploading ? (
          <div className="mt-5 space-y-2" aria-live="polite">
            <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
              <span>Uploading files</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
              <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : null}

        {processing ? (
          <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]" aria-live="polite">
            <LoaderCircle size={18} className="animate-spin text-[var(--color-primary)]" aria-hidden="true" />
            <span>Parsing resumes in the background — this can take a moment. You can wait here for the summary.</span>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {selectedFiles.length ? selectedFiles.map((file) => (
            <UploadRow key={file.id} file={file} onRemove={removeFile} />
          )) : (
            <EmptyState
              icon={FileText}
              title="No files selected"
              description="Use the drop zone or file picker to prepare a new import batch."
            />
          )}
        </div>
      </Card>

      <Dialog
        open={Boolean(resultSummary)}
        onClose={() => setResultSummary(null)}
        title="Resumes processed"
        description={resultSummary?.settled
          ? 'Here is the summary of your upload.'
          : 'Still finishing in the background — here is the progress so far.'}
      >
        {resultSummary ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
              <CheckCircle2 size={22} aria-hidden="true" />
              <p className="text-base font-semibold">
                {resultSummary.parsed} of {resultSummary.total} resume{resultSummary.total === 1 ? '' : 's'} parsed successfully
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Uploaded</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{resultSummary.total}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Parsed</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">{resultSummary.parsed}</p>
              </div>
              {resultSummary.review ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Needs review</p>
                  <p className="mt-1 text-lg font-semibold text-amber-700">{resultSummary.review}</p>
                </div>
              ) : null}
              {resultSummary.duplicates ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Duplicates</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{resultSummary.duplicates}</p>
                </div>
              ) : null}
              {resultSummary.failed ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Failed</p>
                  <p className="mt-1 text-lg font-semibold text-rose-700">{resultSummary.failed}</p>
                </div>
              ) : null}
            </div>
            {resultSummary.review || resultSummary.failed ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Some resumes could not be parsed automatically (often scanned or image-only PDFs). Open the import list to review them.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setResultSummary(null)}>Upload more</Button>
              <Button type="button" variant="primary" as="a" href={historyHref}>View imported resumes</Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export function ResumeImportHistoryExperience({
  initialQuery,
  roleBasePath,
}) {
  const { push } = useToast();
  const [resumes, setResumes] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(Number(initialQuery.page) || 1);
  const [query, setQuery] = useState({
    search: initialQuery.search || '',
    status: initialQuery.status || '',
  });

  async function loadResumes(nextPage = 1, nextQuery = query) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('pageSize', '20');
      if (nextQuery.search) params.set('search', nextQuery.search);
      if (nextQuery.status) params.set('status', nextQuery.status);
      const payload = await jsonRequest(`/api/resume-imports/resumes?${params.toString()}`);
      setResumes(payload.data || []);
      setMeta(payload.meta || null);
      setPage(nextPage);
    } catch (error) {
      push({
        tone: 'error',
        title: 'Could not load resumes',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResumes(1, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Imported resumes become candidate records; unparsed ones are still viewable
  // as their originally uploaded file.
  function resumeViewHref(resume) {
    if (resume.candidateId) return `/api/resumes/candidate/${resume.candidateId}/download`;
    return `/api/resume-imports/${resume.batchId}/items/${resume.id}/download`;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Imported resumes</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Every resume you have uploaded, with its parse status. Open one to view the original resume.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => loadResumes(page, query)}>
              <RefreshCcw size={16} aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" as="a" href={roleBasePath}>
              <Upload size={16} aria-hidden="true" />
              Upload resumes
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Input label="Search by name" value={query.search} onChange={(event) => setQuery((current) => ({ ...current, search: event.target.value }))} placeholder="Resume file name" />
          <Select label="Status" value={query.status} onChange={(event) => setQuery((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All statuses</option>
            <option value="IMPORTED">Parsed</option>
            <option value="REVIEW_REQUIRED">Needs review</option>
            <option value="DUPLICATE">Duplicate</option>
            <option value="FAILED">Failed</option>
          </Select>
          <div className="flex items-end gap-3">
            <Button type="button" className="flex-1" onClick={() => loadResumes(1, query)}>
              <Search size={16} aria-hidden="true" />
              Apply filters
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : resumes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No resumes yet"
            description="Upload resumes to start building your organisation's databank."
            primaryAction={{ href: roleBasePath, label: 'Upload resumes' }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Resume</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Uploaded</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((resume) => (
                  <tr key={resume.id} className="border-b border-[var(--color-border)] align-middle">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text)]">
                      <div className="flex items-center gap-2">
                        <FileText size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
                        <span className="max-w-[22rem] truncate">{resume.originalFilename || 'Resume'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ResumeImportStatusBadge status={resume.status} kind="item" /></td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDateTime(resume.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" as="a" href={resumeViewHref(resume)} target="_blank" rel="noopener noreferrer">
                          <Eye size={14} aria-hidden="true" />
                          View resume
                        </Button>
                        {resume.candidateId ? (
                          <Button type="button" size="sm" variant="ghost" as="a" href={`/recruiter/database/${resume.candidateId}`}>
                            Open profile
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.pageCount > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
            <p>Showing page {meta.page} of {meta.pageCount} | {meta.total} resume(s)</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => loadResumes(meta.page - 1, query)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={meta.page >= meta.pageCount} onClick={() => loadResumes(meta.page + 1, query)}>Next</Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function ResumeImportBatchDetailExperience({
  initialBatch,
  initialItems,
  initialMeta,
  initialQuery,
  batchId,
  historyHref,
  itemHrefBase,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { push } = useToast();
  const [batch, setBatch] = useState(initialBatch);
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date().toISOString());
  const [workerOnline, setWorkerOnline] = useState(null);
  const [query, setQuery] = useState({
    search: initialQuery.search || '',
    status: initialQuery.status || '',
  });

  async function refreshData({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const [batchPayload, itemsPayload] = await Promise.all([
        jsonRequest(`/api/resume-imports/${batchId}`),
        jsonRequest(`/api/resume-imports/${batchId}/items${buildQueryString({ ...initialQuery, pageSize: 100 })}`),
      ]);
      setBatch(batchPayload.data);
      setItems(itemsPayload.data);
      setMeta(itemsPayload.meta);
      setLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      push({
        tone: 'error',
        title: 'Refresh failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  usePagePolling({
    enabled: !RESUME_IMPORT_TERMINAL_BATCH_STATUSES.has(batch?.status),
    intervalMs: 5000,
    onPoll: () => refreshData({ silent: true }),
  });

  async function pollWorkerStatus() {
    try {
      const payload = await jsonRequest('/api/resume-imports/worker-status');
      setWorkerOnline(Boolean(payload.data.online));
    } catch {
      setWorkerOnline(null);
    }
  }

  usePagePolling({
    enabled: !RESUME_IMPORT_TERMINAL_BATCH_STATUSES.has(batch?.status),
    intervalMs: 15000,
    onPoll: pollWorkerStatus,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await jsonRequest('/api/resume-imports/worker-status');
        if (!cancelled) setWorkerOnline(Boolean(payload.data.online));
      } catch {
        if (!cancelled) setWorkerOnline(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const progress = calculateBatchProgress(batch);
  const statusCounts = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  function updateRoute(next) {
    router.push(`${pathname}${buildQueryString(next)}`);
  }

  async function retryFailedBatch() {
    setLoading(true);
    try {
      await jsonRequest(`/api/resume-imports/${batchId}/retry-failed`, {
        method: 'POST',
        body: JSON.stringify({ includeReviewRequired: false }),
      });
      push({
        tone: 'success',
        title: 'Retry queued',
        description: `Failed items for batch ${batchId} were re-queued.`,
      });
      await refreshData({ silent: true });
    } catch (error) {
      push({
        tone: 'error',
        title: 'Retry failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setLoading(false);
    }
  }

  async function downloadFailureReport() {
    try {
      await downloadFromApi(`/api/resume-imports/${batchId}/failure-report`, `resume-import-${batchId}-failures.csv`);
    } catch (error) {
      push({
        tone: 'error',
        title: 'Download failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    }
  }

  return (
    <div className="grid gap-6">
      {workerOnline === false && !RESUME_IMPORT_TERMINAL_BATCH_STATUSES.has(batch?.status) ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert" aria-live="polite">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Resume-processing worker is offline</p>
            <p className="mt-1">No worker has reported a heartbeat recently. Items in this batch will not progress until the background worker process is running.</p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Total" value={batch.totalItemCount} helper="Items in this batch" />
        <SummaryCard label="Imported" value={batch.successCount} helper="Candidate profiles created or linked" />
        <SummaryCard label="Review required" value={batch.reviewCount} helper={`${statusCounts.READY || 0} ready, ${statusCounts.REVIEW_REQUIRED || 0} manual review`} />
        <SummaryCard label="Duplicates" value={batch.duplicateCount} helper="Needs resolution" />
        <SummaryCard label="Failed" value={batch.failedCount} helper={`${statusCounts.CANCELLED || 0} cancelled`} />
      </div>

      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">Batch {batch.id}</h2>
              <ResumeImportStatusBadge status={batch.status} kind="batch" />
            </div>
            <div className="grid gap-1 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
              <p>Uploaded by: {batch.createdByUserId || 'Unknown'}</p>
              <p>Created: {formatDateTime(batch.createdAt)}</p>
              <p>Started: {formatDateTime(batch.startedAt)}</p>
              <p>Completed: {formatDateTime(batch.completedAt)}</p>
              <p>Duration: {formatDuration(batch.durationMs)}</p>
              <p>Last refreshed: {formatDateTime(lastRefreshedAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => refreshData()} loading={loading}>
              <RefreshCcw size={16} aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={downloadFailureReport}>
              <Download size={16} aria-hidden="true" />
              Failure report
            </Button>
            <Button type="button" onClick={retryFailedBatch} disabled={batch.failedCount === 0} loading={loading}>
              Retry failed
            </Button>
            <Button type="button" variant="outline" as="a" href={historyHref}>History</Button>
          </div>
        </div>

        <div className="mt-5 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>Processing progress</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
            <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 md:grid-cols-4">
          <Input label="Search filename or candidate" value={query.search} onChange={(event) => setQuery((current) => ({ ...current, search: event.target.value }))} placeholder="resume.pdf or candidate name" />
          <Select label="Status" value={query.status} onChange={(event) => setQuery((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All item statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="EXTRACTING">Extracting</option>
            <option value="PARSING">Parsing</option>
            <option value="READY">Ready</option>
            <option value="REVIEW_REQUIRED">Review required</option>
            <option value="DUPLICATE">Duplicate</option>
            <option value="IMPORTED">Imported</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <div className="flex items-end gap-3 md:col-span-2">
            <Button type="button" onClick={() => updateRoute({ ...initialQuery, ...query, page: 1 })}>
              <Search size={16} aria-hidden="true" />
              Apply filters
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="space-y-3">
            <TableRowSkeleton columns={6} />
            <TableRowSkeleton columns={6} />
            <TableRowSkeleton columns={6} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No items found"
            description="Adjust the filters to show matching resumes in this batch."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Filename</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Candidate</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Duplicate</th>
                  <th className="px-4 py-3 font-semibold">Error</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const parsed = extractParsedCandidateFields(item);
                  return (
                    <tr key={item.id} className="border-b border-[var(--color-border)] align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--color-text)]">{item.originalFilename}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{item.mimeType} | {formatSize(item.fileSizeBytes)}</p>
                      </td>
                      <td className="px-4 py-3"><ResumeImportStatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{parsed.fullName || 'Not parsed yet'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        <div>{parsed.email || 'No email'}</div>
                        <div>{parsed.phoneNumber || 'No mobile'}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.duplicateReason || 'No'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{getResumeImportErrorMessage(item.errorCode, item.errorMessage || 'No error')}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDateTime(item.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" as="a" href={`${itemHrefBase}/${item.id}`}>Review</Button>
                          <Button type="button" size="sm" variant="outline" as="a" href={`/api/resume-imports/${batchId}/items/${item.id}/download`}>
                            <Download size={14} aria-hidden="true" />
                            Resume
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
            <p>Showing {items.length} item(s) | Page {meta.page} of {meta.pageCount}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => updateRoute({ ...initialQuery, page: meta.page - 1 })}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={meta.page >= meta.pageCount} onClick={() => updateRoute({ ...initialQuery, page: meta.page + 1 })}>Next</Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function ResumeImportItemReviewExperience({
  initialBatch,
  initialItem,
  existingCandidatePreview = null,
  historyHref,
  batchHref,
  candidateProfileHrefBase = null,
  aiEnabled = false,
}) {
  const router = useRouter();
  const { push } = useToast();
  const [item, setItem] = useState(initialItem);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dialogType, setDialogType] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [clientDiagnostic, setClientDiagnostic] = useState('');
  const [duplicateResolution, setDuplicateResolution] = useState('SKIPPED');
  const [resolutionCandidateId, setResolutionCandidateId] = useState(existingCandidatePreview?.id || item.duplicateCandidateId || '');
  const [form, setForm] = useState(() => {
    const parsed = extractParsedCandidateFields(initialItem);
    return {
      fullName: parsed.fullName || '',
      email: parsed.email || '',
      phoneNumber: parsed.phoneNumber || '',
      linkedInUrl: parsed.linkedInUrl || '',
      currentTitle: parsed.currentTitle || '',
      currentEmployer: parsed.currentEmployer || '',
      location: parsed.location || '',
      totalExperience: initialItem?.parsedData?.candidate?.totalExperience?.value ?? '',
      summary: parsed.summary || '',
      skills: joinSkills(parsed.skills),
      reviewNotes: initialItem.reviewNotes || '',
      requiresManualReview: Boolean(initialItem.requiresManualReview),
    };
  });
  const [draftDirty, setDraftDirty] = useState(false);

  const confidenceMap = item?.parsedData?.candidate || {};
  const supportReference = formatResumeImportSupportReference({
    batchId: initialBatch.id,
    itemId: item.id,
    filename: item.originalFilename,
    errorCode: item.errorCode,
  });

  const minimumIdentityMet = hasMinimumIdentityFields({
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim(),
    linkedInUrl: form.linkedInUrl.trim(),
  });

  useEffect(() => {
    function beforeUnload(event) {
      if (!draftDirty) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [draftDirty]);

  async function refreshItem() {
    const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}`);
    setItem(payload.data);
    setDraftDirty(false);
  }

  async function saveReviewDraft() {
    setActionPending(true);
    try {
      const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: form.fullName || null,
          email: form.email || null,
          phoneNumber: form.phoneNumber || null,
          linkedInUrl: form.linkedInUrl || null,
          currentTitle: form.currentTitle || null,
          currentEmployer: form.currentEmployer || null,
          location: form.location || null,
          totalExperience: normalizeExperienceYears(form.totalExperience),
          summary: form.summary || null,
          skills: splitSkills(form.skills),
          reviewNotes: form.reviewNotes || null,
          requiresManualReview: form.requiresManualReview,
        }),
      });
      setItem(payload.data);
      setDraftDirty(false);
      push({
        tone: 'success',
        title: 'Draft saved',
        description: 'Parsed candidate data was updated for recruiter review.',
      });
      router.refresh();
    } catch (error) {
      push({
        tone: 'error',
        title: 'Save failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setActionPending(false);
    }
  }

  async function confirmCandidate() {
    if (!minimumIdentityMet) {
      push({
        tone: 'warning',
        title: 'Minimum identity required',
        description: 'Provide a candidate name and at least one reliable contact identifier before confirmation.',
      });
      return;
    }

    setActionPending(true);
    try {
      const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phoneNumber: form.phoneNumber.trim() || null,
          linkedInUrl: form.linkedInUrl.trim() || null,
          currentTitle: form.currentTitle.trim() || null,
          currentEmployer: form.currentEmployer.trim() || null,
          location: form.location.trim() || null,
          totalExperience: normalizeExperienceYears(form.totalExperience),
          summary: form.summary.trim() || null,
          skills: splitSkills(form.skills),
        }),
      });
      setItem(payload.data.item);
      setDialogType(null);
      setDraftDirty(false);
      push({
        tone: 'success',
        title: payload.data.duplicate ? 'Duplicate review required' : 'Candidate created',
        description: payload.data.duplicate
          ? 'A duplicate was detected during confirmation and the item moved back into duplicate review.'
          : 'The imported candidate profile was created without login credentials or invitation email.',
      });
      router.refresh();
    } catch (error) {
      push({
        tone: 'error',
        title: 'Confirmation failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setActionPending(false);
    }
  }

  async function rejectItem() {
    setActionPending(true);
    try {
      const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: form.reviewNotes.trim() || 'Rejected by recruiter review' }),
      });
      setItem(payload.data);
      setDialogType(null);
      push({
        tone: 'success',
        title: 'Item rejected',
        description: 'The item remains in history and will not create a candidate profile.',
      });
      router.refresh();
    } catch (error) {
      push({
        tone: 'error',
        title: 'Reject failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setActionPending(false);
    }
  }

  async function retryItem() {
    setActionPending(true);
    try {
      const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}/retry`, {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      });
      setItem(payload.data);
      push({
        tone: 'success',
        title: 'Retry queued',
        description: 'The resume item was re-queued for processing.',
      });
      router.refresh();
    } catch (error) {
      push({
        tone: 'error',
        title: 'Retry failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setActionPending(false);
    }
  }

  async function resolveDuplicate() {
    setActionPending(true);
    try {
      const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}/resolve-duplicate`, {
        method: 'POST',
        body: JSON.stringify({
          resolution: duplicateResolution,
          existingCandidateId: resolutionCandidateId || undefined,
          reviewNotes: form.reviewNotes.trim() || null,
        }),
      });
      setItem(payload.data.item);
      setDialogType(null);
      push({
        tone: 'success',
        title: 'Duplicate resolved',
        description: 'The duplicate resolution was recorded successfully.',
      });
      router.refresh();
    } catch (error) {
      push({
        tone: 'error',
        title: 'Resolution failed',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    } finally {
      setActionPending(false);
    }
  }

  async function loadPreview() {
    try {
      const payload = await jsonRequest(`/api/resume-imports/${initialBatch.id}/items/${item.id}/download-url`);
      setPreviewUrl(payload.data.downloadUrl);
    } catch (error) {
      push({
        tone: 'error',
        title: 'Preview unavailable',
        description: getResumeImportErrorMessage(error.code, error.message),
      });
    }
  }

  const canPreviewPdf = item.fileExtension === '.pdf';
  const candidateLink = candidateProfileHrefBase && item.candidateId ? `${candidateProfileHrefBase}/${item.candidateId}` : null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDraftDirty(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.9fr)]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-[var(--color-text)]">{item.originalFilename}</h2>
                <ResumeImportStatusBadge status={item.status} />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">Batch {initialBatch.id} | Updated {formatDateTime(item.updatedAt)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{supportReference}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={saveReviewDraft} loading={actionPending}>
                Save review
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogType('retry')} disabled={item.status === 'IMPORTED'}>
                Retry item
              </Button>
              <Button type="button" variant="danger" onClick={() => setDialogType('reject')}>
                Reject
              </Button>
              <Button type="button" onClick={() => setDialogType(item.status === 'DUPLICATE' ? 'duplicate' : 'confirm')} disabled={item.status === 'CANCELLED'}>
                {item.status === 'DUPLICATE' ? 'Resolve duplicate' : 'Confirm candidate'}
              </Button>
            </div>
          </div>

          {!minimumIdentityMet ? (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" aria-live="polite">
              Candidate confirmation requires a name plus email, mobile, or LinkedIn URL.
            </div>
          ) : null}

          {!aiEnabled ? (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              AI parsing is disabled for this environment. This item should be reviewed manually.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input label="Full name" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required error={!form.fullName.trim() ? 'Required for confirmation.' : undefined} />
            <Input label="Email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            <Input label="Mobile" value={form.phoneNumber} onChange={(event) => updateField('phoneNumber', event.target.value)} />
            <Input label="LinkedIn URL" value={form.linkedInUrl} onChange={(event) => updateField('linkedInUrl', event.target.value)} />
            <Input label="Current designation" value={form.currentTitle} onChange={(event) => updateField('currentTitle', event.target.value)} />
            <Input label="Current employer" value={form.currentEmployer} onChange={(event) => updateField('currentEmployer', event.target.value)} />
            <Input label="Location" value={form.location} onChange={(event) => updateField('location', event.target.value)} />
            <Input label="Total experience" type="number" min="0" value={form.totalExperience} onChange={(event) => updateField('totalExperience', event.target.value)} />
          </div>

          <div className="mt-4 grid gap-4">
            <Textarea label="Summary" value={form.summary} onChange={(event) => updateField('summary', event.target.value)} />
            <Textarea label="Skills" helpText="Comma-separated skills" value={form.skills} onChange={(event) => updateField('skills', event.target.value)} />
            <Textarea label="Review notes" helpText="Visible in recruiter review history" value={form.reviewNotes} onChange={(event) => updateField('reviewNotes', event.target.value)} />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Field confidence</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[
                ['fullName', 'Name'],
                ['email', 'Email'],
                ['phoneNumber', 'Mobile'],
                ['linkedInUrl', 'LinkedIn'],
                ['currentTitle', 'Designation'],
                ['currentEmployer', 'Employer'],
              ].map(([key, label]) => {
                const confidence = formatConfidence(confidenceMap?.[key]?.confidence);
                return (
                  <div key={key} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-[var(--color-text)]">{label}</p>
                      <Badge variant={confidence.tone}>{confidence.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{confidence.label} confidence</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Original resume</h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.originalFilename} | {item.mimeType} | {formatSize(item.fileSizeBytes)}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="outline" as="a" href={`/api/resume-imports/${initialBatch.id}/items/${item.id}/download`}>
              <Download size={16} aria-hidden="true" />
              Download
            </Button>
            {canPreviewPdf ? (
              <Button type="button" variant="outline" onClick={loadPreview}>
                <Eye size={16} aria-hidden="true" />
                Preview PDF
              </Button>
            ) : null}
          </div>
          {previewUrl ? (
            <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <iframe title="Resume preview" src={previewUrl} className="h-[420px] w-full bg-white" />
            </div>
          ) : null}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Processing summary</h3>
          <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-secondary)]">
            <p>Status: <span className="font-semibold text-[var(--color-text)]">{item.status}</span></p>
            <p>Started: {formatDateTime(item.processingStartedAt)}</p>
            <p>Completed: {formatDateTime(item.processingCompletedAt)}</p>
            <p>Duration: {formatDuration(item.durationMs)}</p>
            <p>Manual review: {item.requiresManualReview ? 'Yes' : 'No'}</p>
            <p>Error: {getResumeImportErrorMessage(item.errorCode, item.errorMessage || 'No error')}</p>
          </div>
        </Card>

        {existingCandidatePreview ? (
          <Card>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Duplicate comparison</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Reason: {item.duplicateReason || 'Potential duplicate'}</p>
            <div className="mt-4 grid gap-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Imported record</p>
                <p className="mt-2 font-semibold text-[var(--color-text)]">{form.fullName || 'Name pending review'}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{form.email || 'No email'} | {form.phoneNumber || 'No mobile'}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{form.currentEmployer || 'No employer'} | {form.currentTitle || 'No title'}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Matched candidate</p>
                <p className="mt-2 font-semibold text-[var(--color-text)]">{existingCandidatePreview.fullName}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{existingCandidatePreview.contactEmail || 'Protected email'} | {existingCandidatePreview.currentCompany || 'No employer'}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{existingCandidatePreview.title || 'No title available'}</p>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Navigation</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="outline" as="a" href={batchHref}>Back to batch</Button>
            <Button type="button" variant="outline" as="a" href={historyHref}>Back to history</Button>
            {candidateLink ? (
              <Button type="button" as="a" href={candidateLink}>
                <UserPlus size={16} aria-hidden="true" />
                Open candidate profile
              </Button>
            ) : null}
          </div>
        </Card>

        {clientDiagnostic ? (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-900">{clientDiagnostic}</p>
          </Card>
        ) : null}
      </div>

      <ConfirmActionDialog
        open={dialogType === 'confirm'}
        onClose={() => setDialogType(null)}
        title="Create candidate profile"
        description="This creates a talent-database candidate profile only. Login credentials and invitation email are not created automatically."
        confirmLabel="Confirm and create candidate"
        pending={actionPending}
        onConfirm={confirmCandidate}
      />

      <ConfirmActionDialog
        open={dialogType === 'reject'}
        onClose={() => setDialogType(null)}
        title="Reject import item"
        description="The original resume remains in batch history, but this item will not create a candidate profile."
        confirmLabel="Reject item"
        confirmTone="danger"
        pending={actionPending}
        onConfirm={rejectItem}
      />

      <ConfirmActionDialog
        open={dialogType === 'retry'}
        onClose={() => setDialogType(null)}
        title="Retry resume processing"
        description="Retry this item when parsing or extraction failed, or when you need a fresh processing attempt."
        confirmLabel="Retry item"
        pending={actionPending}
        onConfirm={retryItem}
      />

      <ConfirmActionDialog
        open={dialogType === 'duplicate'}
        onClose={() => setDialogType(null)}
        title="Resolve duplicate candidate"
        description="Choose how this imported resume should be handled against the existing candidate profile."
        confirmLabel="Apply resolution"
        pending={actionPending}
        onConfirm={resolveDuplicate}
      >
        <div className="grid gap-4">
          <Select label="Resolution" value={duplicateResolution} onChange={(event) => setDuplicateResolution(event.target.value)}>
            {RESUME_IMPORT_DUPLICATE_RESOLUTIONS.filter((value) => value !== 'PENDING' && value !== 'REPLACE_SELECTED_FIELDS').map((value) => (
              <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
            ))}
          </Select>
          {duplicateResolution !== 'CREATED_SEPARATE' && duplicateResolution !== 'SKIPPED' && duplicateResolution !== 'REJECTED' ? (
            <Input label="Existing candidate ID" value={resolutionCandidateId} onChange={(event) => setResolutionCandidateId(event.target.value)} />
          ) : null}
          {duplicateResolution === 'CREATED_SEPARATE' ? (
            <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              A separate candidate will be created even though this record may be a duplicate.
            </div>
          ) : null}
        </div>
      </ConfirmActionDialog>
    </div>
  );
}
