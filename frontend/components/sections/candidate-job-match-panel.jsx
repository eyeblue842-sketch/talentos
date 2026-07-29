"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileSearch,
  RefreshCcw,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, TextSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  buildCandidateMatchSupportReference,
  CANDIDATE_MATCH_TERMINAL_STATUSES,
  formatMatchDate,
  formatMatchDecimal,
  formatMatchPercent,
  getCandidateMatchStatusMeta,
  getConfidenceMeta,
  getRecommendationMeta,
  hasPreviousCandidateMatchResult,
  isAiGeneratedStatement,
  mapCandidateMatchError,
  parseCandidateJobMatchResponse,
  parseCandidateJobMatchStatusResponse,
} from '@/lib/match-intelligence';

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    error.code = body?.code || null;
    throw error;
  }

  return body?.data;
}

function SectionCard({ title, description, action, children }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-[var(--color-text)]">{title}</h3>
          {description ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function StatusBadge({ status }) {
  const meta = getCandidateMatchStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function ConfidenceBadge({ confidence }) {
  const meta = getConfidenceMeta(confidence);
  return (
    <Badge tone={meta.tone}>
      {meta.label === 'UNKNOWN' ? 'Confidence unavailable' : `${meta.label} confidence`}
    </Badge>
  );
}

function RecommendationBadge({ label }) {
  const meta = getRecommendationMeta(label);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function ScoreBar({ label, area }) {
  const score = Number.isFinite(area?.score) ? area.score : null;
  const weight = Number.isFinite(area?.weight) ? Math.round(area.weight * 100) : null;
  const confidence = getConfidenceMeta({ label: area?.label, score: null });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Weight {weight != null ? `${weight}%` : 'Not available'}
          </p>
        </div>
        <Badge tone={confidence.tone}>{confidence.label}</Badge>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Score</span>
          <span className="font-semibold text-[var(--color-text)]">{score == null ? 'Not available' : `${score}%`}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
          <div className="h-full bg-[var(--color-primary)]" style={{ width: `${score || 0}%` }} />
        </div>
      </div>
    </div>
  );
}

function SkillSection({ title, items, emptyLabel, collapsedCount = 8 }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, collapsedCount);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{items.length} signal{items.length === 1 ? '' : 's'}</p>
        </div>
        {items.length > collapsedCount ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        ) : null}
      </div>
      {items.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {visible.map((item, index) => (
            <Badge key={`${item.skill}-${index}`} tone={item.generationType === 'AI_GENERATED' ? 'info' : 'neutral'}>
              {item.skill}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{emptyLabel}</p>
      )}
    </div>
  );
}

function StatementList({ items, emptyTitle, emptyDescription, onOpenEvidence }) {
  if (!items?.length) {
    return <EmptyState icon={SearchCheck} title={emptyTitle} description={emptyDescription} className="px-4 py-6" />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.text}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-3xl text-sm font-medium leading-6 text-[var(--color-text)]">{item.text}</p>
            <ConfidenceBadge confidence={item.confidence} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={isAiGeneratedStatement(item) ? 'info' : 'neutral'}>
              {isAiGeneratedStatement(item) ? 'AI-generated' : 'Deterministic'}
            </Badge>
            <span className="text-xs text-[var(--color-text-muted)]">{item.evidence?.length || 0} evidence item{item.evidence?.length === 1 ? '' : 's'}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="min-h-0"
              onClick={() => onOpenEvidence(item.text, item.evidence, item.generationType, item.confidence)}
            >
              View evidence
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceDialog({ state, onClose }) {
  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title={state?.title || 'Evidence'}
      description="Evidence references show which candidate, job, or intelligence fields support the current match statement."
      className="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {state?.confidence ? <ConfidenceBadge confidence={state.confidence} /> : null}
          {state?.generationType ? (
            <Badge tone={state.generationType === 'AI_GENERATED' ? 'info' : 'neutral'}>
              {state.generationType === 'AI_GENERATED' ? 'AI-generated' : 'Deterministic'}
            </Badge>
          ) : null}
        </div>
        {(state?.evidence || []).map((item) => (
          <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="neutral">{item.sourceType.replaceAll('_', ' ')}</Badge>
              {item.confidence ? <ConfidenceBadge confidence={item.confidence} /> : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{item.fieldPath}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.snippet || 'Safe evidence snippet not available.'}</p>
            {item.locator ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.locator}</p> : null}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function OverrideDialog({ open, onClose, onSubmit, pending, generated, effective }) {
  const [form, setForm] = useState({
    type: 'SCORE_ADJUSTMENT',
    scoreDelta: '',
    recommendationOverride: 'MATCH',
    knockoutOverride: false,
    reason: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) {
      setForm({
        type: 'SCORE_ADJUSTMENT',
        scoreDelta: '',
        recommendationOverride: generated?.recommendation?.label || 'MATCH',
        knockoutOverride: Boolean(effective?.isKnockedOut),
        reason: '',
        notes: '',
      });
    }
  }, [effective?.isKnockedOut, generated?.recommendation?.label, open]);

  const requiresReason = ['SCORE_ADJUSTMENT', 'RECOMMENDATION_OVERRIDE', 'KNOCKOUT_OVERRIDE'].includes(form.type);

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      type: form.type,
      notes: form.notes.trim(),
      reason: form.reason.trim(),
    };

    if (form.type === 'SCORE_ADJUSTMENT') payload.scoreDelta = Number(form.scoreDelta || 0);
    if (form.type === 'RECOMMENDATION_OVERRIDE') payload.recommendationOverride = form.recommendationOverride;
    if (form.type === 'KNOCKOUT_OVERRIDE') payload.knockoutOverride = Boolean(form.knockoutOverride);

    onSubmit(payload);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Override effective match result"
      description="Generated values remain unchanged. Overrides only change the effective recruiter-facing result and are fully auditable."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Generated score</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{generated?.overallScore?.score ?? '--'}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Effective score</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{effective?.overallScore ?? generated?.overallScore?.score ?? '--'}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Generated recommendation</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{getRecommendationMeta(generated?.recommendation?.label).label}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Effective recommendation</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{getRecommendationMeta(effective?.recommendation || generated?.recommendation?.label).label}</p>
          </div>
        </div>

        <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
          Override type
          <select
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          >
            <option value="SCORE_ADJUSTMENT">Score Adjustment</option>
            <option value="RECOMMENDATION_OVERRIDE">Recommendation Override</option>
            <option value="KNOCKOUT_OVERRIDE">Knockout Override</option>
            <option value="NOTES_ONLY">Notes Only</option>
          </select>
        </label>

        {form.type === 'SCORE_ADJUSTMENT' ? (
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Score adjustment
            <input
              type="number"
              min="-100"
              max="100"
              value={form.scoreDelta}
              onChange={(event) => setForm((current) => ({ ...current, scoreDelta: event.target.value }))}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        ) : null}

        {form.type === 'RECOMMENDATION_OVERRIDE' ? (
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Effective recommendation
            <select
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
              value={form.recommendationOverride}
              onChange={(event) => setForm((current) => ({ ...current, recommendationOverride: event.target.value }))}
            >
              <option value="STRONG_MATCH">Strong match</option>
              <option value="MATCH">Match</option>
              <option value="PARTIAL_MATCH">Partial match</option>
              <option value="LIMITED_MATCH">Limited match</option>
              <option value="REVIEW_REQUIRED">Review required</option>
            </select>
          </label>
        ) : null}

        {form.type === 'KNOCKOUT_OVERRIDE' ? (
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={form.knockoutOverride}
              onChange={(event) => setForm((current) => ({ ...current, knockoutOverride: event.target.checked }))}
            />
            Mark effective result as knocked out
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
          Reason{requiresReason ? ' *' : ''}
          <textarea
            rows={3}
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            required={requiresReason}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
          Notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" loading={pending}>Save override</Button>
        </div>
      </form>
    </Dialog>
  );
}

function renderLoadingState() {
  return (
    <SectionCard title="AI Match" description="Loading persisted candidate-job fit intelligence.">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="muted"><Skeleton className="h-40 w-full" /></Card>
        <Card variant="muted"><Skeleton className="h-40 w-full" /></Card>
      </div>
    </SectionCard>
  );
}

export function CandidateJobMatchPanel({
  candidateId,
  jobId,
  jobTitle,
  initialResult,
  initialStatus,
  featureEnabled,
  canRead,
  canGenerate,
  canOverride,
}) {
  const { push } = useToast();
  const parsedInitialResult = useMemo(() => {
    if (!initialResult) return null;
    try {
      return parseCandidateJobMatchResponse(initialResult);
    } catch {
      return null;
    }
  }, [initialResult]);
  const parsedInitialStatus = useMemo(() => {
    if (!initialStatus) return null;
    try {
      return parseCandidateJobMatchStatusResponse(initialStatus);
    } catch {
      return null;
    }
  }, [initialStatus]);

  const [result, setResult] = useState(parsedInitialResult);
  const [status, setStatus] = useState(parsedInitialStatus || parsedInitialResult?.execution || null);
  const [loading, setLoading] = useState(!parsedInitialResult && !parsedInitialStatus && featureEnabled && canRead && Boolean(jobId));
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overridePending, setOverridePending] = useState(false);
  const [evidenceState, setEvidenceState] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef(null);

  const activeStatus = status?.status || result?.execution?.status || null;
  const previousResultVisible = hasPreviousCandidateMatchResult(result);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!featureEnabled || !canRead || !jobId || parsedInitialResult || parsedInitialStatus) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match`).catch(() => null),
      requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match/status`).catch(() => null),
    ])
      .then(([matchResult, matchStatus]) => {
        if (cancelled) return;
        if (matchResult) setResult(parseCandidateJobMatchResponse(matchResult));
        if (matchStatus) setStatus(parseCandidateJobMatchStatusResponse(matchStatus));
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(mapCandidateMatchError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [candidateId, canRead, featureEnabled, jobId, parsedInitialResult, parsedInitialStatus]);

  useEffect(() => {
    if (!featureEnabled || !canRead || !jobId) return undefined;
    if (!activeStatus || CANDIDATE_MATCH_TERMINAL_STATUSES.has(activeStatus)) {
      setPolling(false);
      return undefined;
    }

    let cancelled = false;
    setPolling(true);

    async function poll() {
      if (document.hidden) {
        pollTimerRef.current = setTimeout(poll, 5000);
        return;
      }

      try {
        const nextStatus = parseCandidateJobMatchStatusResponse(await requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match/status`));
        if (cancelled) return;
        setStatus(nextStatus);

        if (CANDIDATE_MATCH_TERMINAL_STATUSES.has(nextStatus.status)) {
          setPolling(false);
          if (nextStatus.latestResultId) {
            const nextResult = parseCandidateJobMatchResponse(await requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match`));
            if (!cancelled) setResult(nextResult);
          }
          return;
        }
      } catch (caught) {
        if (!cancelled) {
          setError(mapCandidateMatchError(caught));
          setPolling(false);
        }
        return;
      }

      pollTimerRef.current = setTimeout(poll, 4000);
    }

    pollTimerRef.current = setTimeout(poll, 4000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [activeStatus, candidateId, canRead, featureEnabled, jobId]);

  async function handleRegenerate() {
    if (!jobId) return;
    setRegenerating(true);
    setError('');

    try {
      const nextStatus = await requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ forceRegenerate: true }),
      });
      setStatus(parseCandidateJobMatchStatusResponse(nextStatus));
      push({ tone: 'success', message: 'Candidate-job match regeneration started.' });
    } catch (caught) {
      const message = mapCandidateMatchError(caught);
      setError(message);
      push({ tone: 'danger', message });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleOverride(payload) {
    if (!jobId) return;
    setOverridePending(true);
    setError('');

    try {
      await requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match/override`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const nextResult = await requestJson(`/api/intelligence/jobs/${jobId}/candidates/${candidateId}/match`);
      setResult(parseCandidateJobMatchResponse(nextResult));
      setOverrideOpen(false);
      push({ tone: 'success', message: 'Match override saved.' });
    } catch (caught) {
      const message = mapCandidateMatchError(caught);
      setError(message);
      push({ tone: 'danger', message });
    } finally {
      setOverridePending(false);
    }
  }

  function openEvidence(title, evidence, generationType, confidence) {
    setEvidenceState({ title, evidence, generationType, confidence });
  }

  if (!featureEnabled) {
    return (
      <SectionCard title="AI Match" description="Candidate-job matching is currently unavailable in this workspace.">
        <EmptyState
          icon={ShieldCheck}
          title="AI Match is disabled"
          description="This feature flag is turned off, so recruiter-facing match results are hidden in this environment."
        />
      </SectionCard>
    );
  }

  if (!canRead) {
    return (
      <SectionCard title="AI Match" description="Candidate-job matching is permission controlled.">
        <EmptyState
          icon={ShieldCheck}
          title="You do not have access to AI Match"
          description="A recruiter with candidate matching read access can view persisted match results for this candidate."
        />
      </SectionCard>
    );
  }

  if (!jobId) {
    return (
      <SectionCard title="AI Match" description="Candidate-job fit requires a specific job context.">
        <EmptyState
          icon={FileSearch}
          title="Select a job to view AI Match"
          description="Open this candidate from a recruiter job, ATS candidate list, or ranking workspace so the profile can be compared against a specific job."
        />
      </SectionCard>
    );
  }

  if (loading) {
    return renderLoadingState();
  }

  if (error && !result && !status) {
    return (
      <SectionCard title="AI Match" description={`Candidate-job fit for ${jobTitle || 'the selected job'}.`}>
        <EmptyState
          icon={AlertTriangle}
          title="Candidate-job match could not be loaded"
          description={error}
          secondaryAction={{
            label: 'Try again',
            onClick: () => {
              setResult(null);
              setStatus(null);
              setLoading(true);
            },
          }}
        />
      </SectionCard>
    );
  }

  if (!result && ['REVIEW_REQUIRED', 'DISABLED', 'FAILED'].includes(activeStatus || '')) {
    const meta = getCandidateMatchStatusMeta(activeStatus);
    return (
      <SectionCard title="AI Match" description={`Candidate-job fit for ${jobTitle || 'the selected job'}.`}>
        <EmptyState
          icon={activeStatus === 'FAILED' ? AlertTriangle : CircleAlert}
          title={meta.label}
          description={meta.description}
          primaryAction={canGenerate ? { label: 'Regenerate', onClick: handleRegenerate } : null}
        />
      </SectionCard>
    );
  }

  if (!result && activeStatus === 'PENDING') {
    return (
      <SectionCard title="AI Match" description={`Candidate-job fit for ${jobTitle || 'the selected job'}.`}>
        <EmptyState
          icon={Sparkles}
          title="Generating the first candidate-job match result"
          description="The candidate-job match engine is processing this pair in the background. This page updates automatically once the result is ready."
        />
      </SectionCard>
    );
  }

  if (!result) {
    return (
      <SectionCard title="AI Match" description={`Candidate-job fit for ${jobTitle || 'the selected job'}.`}>
        <EmptyState
          icon={FileSearch}
          title="No persisted match result yet"
          description="Generate the first candidate-job match result to review score breakdowns, evidence, and recruiter-safe AI summary."
          primaryAction={canGenerate ? { label: 'Generate match', onClick: handleRegenerate } : null}
        />
      </SectionCard>
    );
  }

  const recommendationMeta = getRecommendationMeta(result.recommendation?.label);
  const qualityMeta = getConfidenceMeta({ label: result.overallScore?.label, score: null });

  return (
    <>
      <SectionCard
        title="AI Match"
        description={`Candidate-job fit for ${jobTitle || 'the selected job'}.`}
        action={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled>
              View history
            </Button>
            {canOverride ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setOverrideOpen(true)}>
                Override
              </Button>
            ) : null}
            {canGenerate ? (
              <Button type="button" size="sm" loading={regenerating} onClick={handleRegenerate} leadingIcon={RefreshCcw}>
                Regenerate
              </Button>
            ) : null}
          </div>
        )}
      >
        <div className="space-y-5">
          {activeStatus === 'STALE' ? (
            <Card variant="outlined" className="border-amber-200 bg-amber-50">
              <div className="flex gap-3">
                <CircleAlert className="mt-0.5 text-amber-700" size={18} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-900">Candidate or job information changed after this result was generated.</p>
                  <p className="mt-1 text-sm text-amber-900/80">The last successful match result stays visible until a replacement generation completes.</p>
                </div>
              </div>
            </Card>
          ) : null}

          {activeStatus === 'PENDING' && previousResultVisible ? (
            <Card variant="outlined" className="border-blue-200 bg-blue-50">
              <div className="flex gap-3">
                <RefreshCcw className="mt-0.5 text-blue-700" size={18} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-blue-900">A fresh match result is generating in the background.</p>
                  <p className="mt-1 text-sm text-blue-900/80">The previous successful result stays visible while polling continues.</p>
                </div>
              </div>
            </Card>
          ) : null}

          {activeStatus === 'FAILED' && previousResultVisible ? (
            <Card variant="outlined" className="border-rose-200 bg-rose-50">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-rose-700" size={18} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-rose-900">The latest generation attempt did not complete successfully.</p>
                  <p className="mt-1 text-sm text-rose-900/80">The last successful result remains available for review.</p>
                </div>
              </div>
            </Card>
          ) : null}

          {activeStatus === 'DISABLED' ? (
            <Card variant="outlined" className="border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 text-slate-700" size={18} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-900">AI-generated matching is currently unavailable.</p>
                  <p className="mt-1 text-sm text-slate-900/80">Deterministic recruiter-safe scoring remains available for this candidate-job pair.</p>
                </div>
              </div>
            </Card>
          ) : null}

          {error ? (
            <Card variant="outlined" className="border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-900">{error}</p>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Overall Match Score</p>
                  <p className="mt-3 text-5xl font-semibold text-[var(--color-text)]">{result.overallScore?.score ?? '--'}%</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ConfidenceBadge confidence={result.confidence} />
                    <RecommendationBadge label={result.recommendation?.label} />
                    <Badge tone={qualityMeta.tone}>{qualityMeta.label === 'UNKNOWN' ? 'Match quality unavailable' : `${qualityMeta.label} match quality`}</Badge>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeStatus} />
                    <Badge tone={result.execution?.aiEnabled ? 'info' : 'neutral'}>
                      {result.execution?.aiEnabled ? 'AI enabled' : 'Deterministic only'}
                    </Badge>
                  </div>
                  <p>Generated: {formatMatchDate(result.execution?.generatedAt)}</p>
                  <p>Confidence: {formatMatchDecimal(result.confidence?.score)}</p>
                  <p>Support: {buildCandidateMatchSupportReference(result) || 'Not available'}</p>
                  {polling ? <p>Polling for updates…</p> : null}
                </div>
              </div>
              <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Recommendation</p>
                  <RecommendationBadge label={result.recommendation?.label} />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{result.recommendation?.reason?.text || 'Recommendation reason unavailable.'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="min-h-0"
                    onClick={() => openEvidence('Recommendation evidence', result.recommendation?.reason?.evidence, result.recommendation?.reason?.generationType, result.recommendation?.reason?.confidence)}
                  >
                    View evidence
                  </Button>
                  <span className="text-xs text-[var(--color-text-muted)]">{result.recommendation?.reason?.evidence?.length || 0} evidence item{result.recommendation?.reason?.evidence?.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h4 className="text-sm font-semibold text-[var(--color-text)]">Generated vs effective values</h4>
              <div className="mt-4 grid gap-4">
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Generated score</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{result.overallScore?.score ?? '--'}%</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Effective score</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{result.effective?.overallScore ?? result.overallScore?.score ?? '--'}%</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Generated recommendation</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{recommendationMeta.label}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Effective recommendation</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{getRecommendationMeta(result.effective?.recommendation || result.recommendation?.label).label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={result.effective?.isKnockedOut ? 'danger' : 'success'}>
                      {result.effective?.isKnockedOut ? 'Knocked out' : 'Eligible'}
                    </Badge>
                    <Badge tone={result.effective?.hasOverride ? 'warning' : 'neutral'}>
                      {result.effective?.hasOverride ? 'Override applied' : 'No override'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Score Breakdown" description="Deterministic scoring dimensions returned by the candidate match engine.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ScoreBar label="Required Skills" area={result.scoreBreakdown?.requiredSkills} />
          <ScoreBar label="Preferred Skills" area={result.scoreBreakdown?.preferredSkills} />
          <ScoreBar label="Experience" area={result.scoreBreakdown?.experience} />
          <ScoreBar label="Role Alignment" area={result.scoreBreakdown?.roleTitle} />
          <ScoreBar label="Education" area={result.scoreBreakdown?.education} />
          <ScoreBar label="Location" area={result.scoreBreakdown?.location} />
          <ScoreBar label="Work Mode" area={result.scoreBreakdown?.workMode} />
          <ScoreBar label="Availability" area={result.scoreBreakdown?.noticePeriod} />
          <ScoreBar label="Compensation" area={result.scoreBreakdown?.compensation} />
          <ScoreBar label="Employment Type" area={result.scoreBreakdown?.employmentType} />
        </div>
      </SectionCard>

      <SectionCard title="Skills" description="Normalized skill alignment signals reused from the persisted match result.">
        <div className="grid gap-4 xl:grid-cols-2">
          <SkillSection title="Matched Required Skills" items={result.skills?.matchedRequired || []} emptyLabel="No required skills were matched." />
          <SkillSection title="Matched Preferred Skills" items={result.skills?.matchedPreferred || []} emptyLabel="No preferred skills were matched." />
          <SkillSection title="Missing Required Skills" items={result.skills?.missingRequired || []} emptyLabel="No required gaps were detected." />
          <SkillSection title="Missing Preferred Skills" items={result.skills?.missingPreferred || []} emptyLabel="No preferred skill gaps were detected." />
          <SkillSection title="Transferable Skills" items={result.skills?.transferable || []} emptyLabel="No transferable skills were surfaced." />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Strengths" description="Supported positive fit signals for this candidate-job pair.">
          <StatementList
            items={result.strengths}
            emptyTitle="No strengths available"
            emptyDescription="The match result did not return supported strengths for this candidate-job pair."
            onOpenEvidence={openEvidence}
          />
        </SectionCard>

        <SectionCard title="Risks" description="Neutral recruiter review points and missing-fit signals to validate during evaluation.">
          <StatementList
            items={result.risks}
            emptyTitle="No risks available"
            emptyDescription="No recruiter review risks were returned for this candidate-job pair."
            onOpenEvidence={openEvidence}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Interview Focus" description="Suggested focus areas to verify during structured interviews.">
          <StatementList
            items={result.interviewFocus}
            emptyTitle="No interview focus available"
            emptyDescription="Interview focus areas are not available for this candidate-job pair."
            onOpenEvidence={openEvidence}
          />
        </SectionCard>

        <SectionCard title="Recruiter Summary" description="A recruiter-safe summary returned from the persisted match result.">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-3xl text-sm leading-6 text-[var(--color-text)]">{result.recruiterSummary?.text || 'Recruiter summary unavailable.'}</p>
              <ConfidenceBadge confidence={result.recruiterSummary?.confidence} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge tone={isAiGeneratedStatement(result.recruiterSummary) ? 'info' : 'neutral'}>
                {isAiGeneratedStatement(result.recruiterSummary) ? 'AI-generated' : 'Deterministic'}
              </Badge>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="min-h-0"
                onClick={() => openEvidence('Recruiter summary evidence', result.recruiterSummary?.evidence, result.recruiterSummary?.generationType, result.recruiterSummary?.confidence)}
              >
                View evidence
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Knockout Results & Warnings" description="Deterministic knockout evaluation and safe data-quality warnings.">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            {result.knockoutResults?.length ? result.knockoutResults.map((item) => (
              <div key={item.ruleKey} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.ruleKey}</p>
                  <Badge tone={item.triggered ? 'danger' : 'success'}>{item.triggered ? 'Triggered' : 'Passed'}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.reason}</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-2 min-h-0"
                  onClick={() => openEvidence(`Knockout evidence: ${item.ruleKey}`, item.evidence, 'DETERMINISTIC', { label: 'HIGH', score: 1 })}
                >
                  View evidence
                </Button>
              </div>
            )) : <p className="text-sm text-[var(--color-text-secondary)]">No knockout rules were evaluated for this result.</p>}
          </div>
          <div className="space-y-3">
            {result.warnings?.length ? result.warnings.map((warning, index) => (
              <div key={`${warning}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <p className="text-sm text-[var(--color-text-secondary)]">{warning}</p>
              </div>
            )) : <p className="text-sm text-[var(--color-text-secondary)]">No data-quality warnings were returned.</p>}
          </div>
        </div>
      </SectionCard>

      {result.overrides?.length ? (
        <SectionCard title="Override Audit" description="Recruiter overrides do not mutate the generated result and remain separately auditable.">
          <div className="space-y-3">
            {result.overrides.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge tone="warning">{item.type.replaceAll('_', ' ')}</Badge>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatMatchDate(item.createdAt)}</p>
                </div>
                {item.reason ? <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{item.reason}</p> : null}
                {item.notes ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.notes}</p> : null}
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">Created by user {item.createdByUserId}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <EvidenceDialog state={evidenceState} onClose={() => setEvidenceState(null)} />
      <OverrideDialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        onSubmit={handleOverride}
        pending={overridePending}
        generated={{
          overallScore: result.overallScore,
          recommendation: result.recommendation,
        }}
        effective={result.effective}
      />
    </>
  );
}
