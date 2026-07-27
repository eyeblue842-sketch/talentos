"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CircleAlert,
  Clock3,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, TextSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  buildCandidateIntelligenceSupportReference,
  CANDIDATE_INTELLIGENCE_TERMINAL_STATUSES,
  canRenderProfessionalSummary,
  formatInsightDate,
  formatInsightPercentage,
  formatInsightScore,
  getCandidateIntelligenceStatusMeta,
  getConfidenceMeta,
  getQualityMeta,
  groupNormalizedSkills,
  hasPreviousCandidateIntelligenceResult,
  isAiGeneratedStatement,
  mapCandidateIntelligenceError,
  parseCandidateIntelligenceResponse,
  parseCandidateIntelligenceStatusResponse,
} from '@/lib/candidate-intelligence';

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

function formatDurationLabel(startDate, endDate, currentlyWorking) {
  if (!startDate) return 'Dates not provided';

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return currentlyWorking ? 'Current role' : 'Dates not provided';
  }

  const totalMonths = Math.max(0, ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth()));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [years ? `${years} yr${years > 1 ? 's' : ''}` : null, months ? `${months} mo` : null].filter(Boolean);
  return parts.length ? parts.join(' ') : (currentlyWorking ? 'Current role' : 'Less than 1 month');
}

function redactEvidenceSnippet(snippet) {
  if (!snippet) return 'Evidence snippet not available.';
  return snippet;
}

function StatusBadge({ status }) {
  const meta = getCandidateIntelligenceStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function ConfidenceBadge({ confidence }) {
  const meta = getConfidenceMeta(confidence);
  return (
    <Badge tone={meta.tone}>
      {meta.label === 'UNKNOWN' ? 'Not available' : `${meta.label} confidence`}
    </Badge>
  );
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

function SnapshotGrid({ snapshot }) {
  const items = [
    ['Total experience', snapshot?.totalExperience != null ? `${snapshot.totalExperience} years` : 'Not provided'],
    ['Current role', snapshot?.currentTitle || 'Not provided'],
    ['Current company', snapshot?.currentEmployer || 'Not provided'],
    ['Location', snapshot?.location || 'Not provided'],
    ['Resume availability', snapshot?.resumeAvailable ? 'Available' : 'Not provided'],
    ['Skills', snapshot?.structuredCounts?.skills != null ? `${snapshot.structuredCounts.skills}` : 'Not provided'],
    ['Employers', snapshot?.structuredCounts?.experienceEntries != null ? `${snapshot.structuredCounts.experienceEntries}` : 'Not provided'],
    ['Education entries', snapshot?.structuredCounts?.educationEntries != null ? `${snapshot.structuredCounts.educationEntries}` : 'Not provided'],
    ['Projects', snapshot?.structuredCounts?.projectEntries != null ? `${snapshot.structuredCounts.projectEntries}` : 'Not provided'],
    ['Certifications', snapshot?.structuredCounts?.certificationEntries != null ? `${snapshot.structuredCounts.certificationEntries}` : 'Not provided'],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function StatementList({ items, emptyTitle, emptyDescription, onOpenEvidence, renderTitle = (item) => item.text }) {
  if (!items?.length) {
        return <EmptyState icon={SearchCheck} title={emptyTitle} description={emptyDescription} className="px-4 py-6" />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.text}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-3xl text-sm font-medium leading-6 text-[var(--color-text)]">{renderTitle(item)}</p>
            <ConfidenceBadge confidence={item.confidence} />
          </div>
          {item.rationale ? <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.rationale}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={isAiGeneratedStatement(item) ? 'info' : 'neutral'}>
              {isAiGeneratedStatement(item) ? 'AI-generated' : 'Deterministic'}
            </Badge>
            <span className="text-xs text-[var(--color-text-muted)]">{item.evidence?.length || 0} evidence item{item.evidence?.length === 1 ? '' : 's'}</span>
            <Button type="button" variant="link" size="sm" className="min-h-0" onClick={() => onOpenEvidence(item.text, item.evidence, item.generationType, item.confidence)}>
              View evidence
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillIntelligence({ skills, keywordClusters, onOpenEvidence }) {
  const groupedSkills = useMemo(() => groupNormalizedSkills(skills), [skills]);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-5">
      {groupedSkills.length ? (
        <div className="space-y-4">
          {groupedSkills.map((group) => {
            const visibleSkills = expanded ? group.skills : group.skills.slice(0, 8);
            return (
              <div key={group.category} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text)]">{group.category}</h4>
                    <p className="text-xs text-[var(--color-text-muted)]">{group.skills.length} normalized skill{group.skills.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSkills.map((skill) => (
                    <Badge key={skill.name} tone="neutral">{skill.name}</Badge>
                  ))}
                </div>
              </div>
            );
          })}
          {groupedSkills.some((group) => group.skills.length > 8) ? (
            <Button type="button" variant="outline" onClick={() => setExpanded((current) => !current)}>
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          ) : null}
        </div>
      ) : (
        <EmptyState icon={SearchCheck} title="No normalized skills" description="Candidate intelligence did not return normalized skill groups for this profile." className="px-4 py-6" />
      )}

      {keywordClusters?.length ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[var(--color-text)]">Keyword clusters</h4>
          <StatementList
            items={keywordClusters}
            emptyTitle="No keyword clusters"
            emptyDescription="Keyword clusters are not available."
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      ) : null}
    </div>
  );
}

function CareerTimeline({ timeline }) {
  if (!timeline?.length) {
    return <EmptyState icon={Clock3} title="No structured timeline" description="Career history is limited for this candidate profile." className="px-4 py-6" />;
  }

  return (
    <div className="space-y-4">
      {timeline.map((item) => (
        <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--color-text)]">{item.title || 'Role not provided'}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.company || 'Employer not provided'}</p>
            </div>
            <Badge tone="neutral">{formatDurationLabel(item.startDate, item.endDate, item.currentlyWorking)}</Badge>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-3">
            <p>Start: {item.startDate || 'Not provided'}</p>
            <p>End: {item.currentlyWorking ? 'Present' : (item.endDate || 'Not provided')}</p>
            <p>Location: {item.location || 'Not provided'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileCompleteness({ profileCompleteness }) {
  const percentage = Math.max(0, Math.min(100, Number(profileCompleteness?.score || 0)));
  const tone = profileCompleteness?.label === 'HIGH' ? 'success' : profileCompleteness?.label === 'MEDIUM' ? 'info' : 'warning';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold text-[var(--color-text)]">{formatInsightPercentage(percentage)}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Profile completeness score</p>
        </div>
        <Badge tone={tone}>{profileCompleteness?.label || 'LOW'}</Badge>
      </div>
      <div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--color-bg-muted)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-label="Profile completeness">
          <div className="h-full bg-[var(--color-primary)]" style={{ width: `${percentage}%` }} />
        </div>
      </div>
      {profileCompleteness?.missingFields?.length ? (
        <ul className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
          {profileCompleteness.missingFields.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">No major completeness gaps were flagged.</p>
      )}
    </div>
  );
}

function GenerationStatusPanel({ title, description, pending }) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2 text-blue-700 shadow-[var(--shadow-sm)]">
          {pending ? <RefreshCcw className="animate-spin" size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
        </div>
        <div>
          <h3 className="font-semibold text-blue-950">{title}</h3>
          <p className="mt-1 text-sm text-blue-900">{description}</p>
        </div>
      </div>
    </Card>
  );
}

export function CandidateInsightsPanel({
  candidateId,
  initialResult,
  initialStatus,
  featureEnabled,
  canRead,
  canGenerate,
}) {
  const { push } = useToast();
  const parsedInitialResult = useMemo(() => {
    if (!initialResult) return null;
    try {
      return parseCandidateIntelligenceResponse(initialResult);
    } catch {
      return null;
    }
  }, [initialResult]);
  const parsedInitialStatus = useMemo(() => {
    if (!initialStatus) return null;
    try {
      return parseCandidateIntelligenceStatusResponse(initialStatus);
    } catch {
      return null;
    }
  }, [initialStatus]);

  const [result, setResult] = useState(parsedInitialResult);
  const [status, setStatus] = useState(parsedInitialStatus || {
    candidateId,
    kind: 'PROFILE_OVERVIEW',
    status: parsedInitialResult?.execution?.status || 'PENDING',
    stale: Boolean(parsedInitialResult?.execution?.stale),
    aiEnabled: Boolean(parsedInitialResult?.execution?.aiEnabled),
    generatedAt: parsedInitialResult?.execution?.generatedAt || null,
    latestExecutionId: parsedInitialResult?.execution?.executionId || null,
    latestResultId: parsedInitialResult?.execution?.resultId || null,
    sourceVersion: parsedInitialResult?.execution?.sourceVersion || 'unknown',
    promptVersion: parsedInitialResult?.execution?.promptVersion || 'unknown',
    resultVersion: parsedInitialResult?.execution?.resultVersion || 'unknown',
  });
  const [loading, setLoading] = useState(!parsedInitialResult && canRead && featureEnabled);
  const [error, setError] = useState('');
  const [evidenceState, setEvidenceState] = useState(null);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [polling, setPolling] = useState((parsedInitialStatus?.status || parsedInitialResult?.execution?.status) === 'PENDING');
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollStartedAtRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const statusMeta = getCandidateIntelligenceStatusMeta(status?.status || result?.execution?.status);
  const qualityMeta = getQualityMeta(result?.quality);
  const confidenceMeta = getConfidenceMeta({
    score: result?.confidence?.overallScore,
    label: result?.confidence?.overallLabel || 'UNKNOWN',
  });
  const supportReference = buildCandidateIntelligenceSupportReference(result);
  const groupedSkills = useMemo(() => groupNormalizedSkills(result?.skills?.normalized || []), [result?.skills?.normalized]);
  const hasPreviousResult = hasPreviousCandidateIntelligenceResult(result);
  const showLimitedDataState = !canRenderProfessionalSummary(result) && !groupedSkills.length && !(result?.timeline?.length);

  async function refreshFullResult() {
    const payload = await requestJson(`/api/intelligence/candidates/${candidateId}`);
    const parsed = parseCandidateIntelligenceResponse(payload);
    setResult(parsed);
    setStatus((current) => ({
      ...current,
      status: parsed.execution.status,
      stale: parsed.execution.stale,
      aiEnabled: parsed.execution.aiEnabled,
      generatedAt: parsed.execution.generatedAt,
      latestExecutionId: parsed.execution.executionId,
      latestResultId: parsed.execution.resultId,
      sourceVersion: parsed.execution.sourceVersion,
      promptVersion: parsed.execution.promptVersion,
      resultVersion: parsed.execution.resultVersion,
    }));
    setError('');
  }

  async function refreshStatus() {
    const payload = await requestJson(`/api/intelligence/candidates/${candidateId}/status`);
    const parsed = parseCandidateIntelligenceStatusResponse(payload);
    setStatus(parsed);
    return parsed;
  }

  useEffect(() => {
    if (!featureEnabled || !canRead || parsedInitialResult) return undefined;
    let cancelled = false;

    setLoading(true);
    requestJson(`/api/intelligence/candidates/${candidateId}`)
      .then((payload) => {
        if (cancelled) return;
        const parsed = parseCandidateIntelligenceResponse(payload);
        setResult(parsed);
        setStatus({
          candidateId,
          kind: 'PROFILE_OVERVIEW',
          status: parsed.execution.status,
          stale: parsed.execution.stale,
          aiEnabled: parsed.execution.aiEnabled,
          generatedAt: parsed.execution.generatedAt,
          latestExecutionId: parsed.execution.executionId,
          latestResultId: parsed.execution.resultId,
          sourceVersion: parsed.execution.sourceVersion,
          promptVersion: parsed.execution.promptVersion,
          resultVersion: parsed.execution.resultVersion,
        });
      })
      .catch((caught) => {
        if (!cancelled) setError(mapCandidateIntelligenceError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [candidateId, canRead, featureEnabled, parsedInitialResult]);

  useEffect(() => {
    if (!polling) return undefined;

    if (!pollStartedAtRef.current) {
      pollStartedAtRef.current = Date.now();
    }

    let cancelled = false;
    let timer = null;

    async function pollOnce() {
      if (cancelled || requestInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer = window.setTimeout(pollOnce, 8000);
        return;
      }

      if (Date.now() - pollStartedAtRef.current > 120000) {
        setPolling(false);
        setPollTimedOut(true);
        return;
      }

      requestInFlightRef.current = true;
      try {
        const nextStatus = await refreshStatus();
        if (CANDIDATE_INTELLIGENCE_TERMINAL_STATUSES.has(nextStatus.status)) {
          setPolling(false);
          await refreshFullResult().catch(() => null);
          return;
        }
      } catch (caught) {
        setError(mapCandidateIntelligenceError(caught));
      } finally {
        requestInFlightRef.current = false;
      }

      if (!cancelled) {
        timer = window.setTimeout(pollOnce, 4000);
      }
    }

    timer = window.setTimeout(pollOnce, 4000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [candidateId, polling]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const payload = await requestJson(`/api/intelligence/candidates/${candidateId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'PROFILE_OVERVIEW', forceRegenerate: true }),
      });

      setStatus((current) => ({
        ...current,
        status: payload.status || 'PENDING',
        stale: Boolean(payload.execution?.stale),
        aiEnabled: Boolean(payload.aiEnabled),
      }));
      setConfirmRegenerateOpen(false);
      setPollTimedOut(false);
      pollStartedAtRef.current = Date.now();
      setPolling(true);
      push({
        tone: 'success',
        title: 'Candidate insights queued',
        description: 'A new background generation request is now running for this profile.',
      });
    } catch (caught) {
      push({
        tone: 'error',
        title: 'Regeneration failed',
        description: mapCandidateIntelligenceError(caught),
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleManualRefresh() {
    try {
      await Promise.all([refreshStatus(), refreshFullResult()]);
      push({
        tone: 'success',
        title: 'Candidate insights refreshed',
        description: 'The latest candidate intelligence result was loaded.',
      });
    } catch (caught) {
      push({
        tone: 'error',
        title: 'Refresh failed',
        description: mapCandidateIntelligenceError(caught),
      });
    }
  }

  if (!featureEnabled) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 text-[var(--color-text-muted)]" />
          <div>
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">Candidate Insights</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Candidate intelligence is disabled for this frontend environment.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!canRead) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="Candidate insights unavailable"
          description="This user does not have permission to view candidate intelligence for recruiter-facing profiles."
        />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-3 h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">Candidate Insights</h2>
              <StatusBadge status={status?.status || result?.execution?.status} />
              <Badge tone={status?.aiEnabled ? 'info' : 'neutral'}>
                {status?.aiEnabled ? 'AI enabled' : 'Deterministic only'}
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-[var(--color-text-secondary)]">{statusMeta.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>Generated: {formatInsightDate(status?.generatedAt || result?.execution?.generatedAt)}</span>
              <span>{status?.stale ? 'Stale result shown' : 'Latest result shown'}</span>
              {supportReference ? <span>{supportReference}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={handleManualRefresh}>
              <RefreshCcw size={16} aria-hidden="true" />
              Refresh
            </Button>
            {canGenerate ? (
              <Button type="button" onClick={() => setConfirmRegenerateOpen(true)} disabled={regenerating || polling}>
                <Sparkles size={16} aria-hidden="true" />
                Regenerate insights
              </Button>
            ) : null}
          </div>
        </div>

        {status?.stale ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Candidate information changed after the current insights were generated. The existing result remains available until a new generation completes.
          </div>
        ) : null}

        {polling && hasPreviousResult ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            A new intelligence run is in progress. The previous successful result stays visible until the refresh completes.
          </div>
        ) : null}

        {!status?.aiEnabled ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            AI-generated insights are currently unavailable. Profile completeness and missing-information checks are still available.
          </div>
        ) : null}

        {status?.status === 'FAILED' ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            The latest generation attempt did not complete successfully. Safe cached profile signals remain available.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {pollTimedOut ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Candidate insights are still processing. Use manual refresh to check again.
          </div>
        ) : null}
      </Card>

      {polling && !hasPreviousResult ? (
        <GenerationStatusPanel
          title="Generating the first candidate insights result"
          description="The structured baseline is available immediately. AI-backed summary, strengths, and role suggestions will appear after background generation completes."
          pending
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Profile snapshot"
            description="Structured facts already available for this candidate profile."
          >
            <SnapshotGrid snapshot={result?.snapshot} />
          </SectionCard>

          <SectionCard
            title="Professional summary"
            description="A recruiter-oriented summary of the candidate profile and resume signals."
            action={result?.summary?.professionalSummary ? <ConfidenceBadge confidence={result.summary.professionalSummary.confidence} /> : null}
          >
            {result?.summary?.professionalSummary?.text ? (
              <div className="space-y-4">
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{result.summary.professionalSummary.text}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={isAiGeneratedStatement(result.summary.professionalSummary) ? 'info' : 'neutral'}>
                    {isAiGeneratedStatement(result.summary.professionalSummary) ? 'AI-generated' : 'Deterministic'}
                  </Badge>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="min-h-0"
                    onClick={() => setEvidenceState({
                      title: 'Professional summary evidence',
                      evidence: result.summary.professionalSummary.evidence,
                      generationType: result.summary.professionalSummary.generationType,
                      confidence: result.summary.professionalSummary.confidence,
                    })}
                  >
                    View evidence
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={Bot} title="Summary unavailable" description="A professional summary is not available for this candidate profile yet." className="px-4 py-6" />
            )}
          </SectionCard>

          <SectionCard
            title="Strengths"
            description="Evidence-backed recruiter observations about the candidate's profile."
          >
            {polling && !hasPreviousResult ? (
              <TextSkeleton lines={4} />
            ) : (
              <StatementList
                items={result?.strengths || []}
                emptyTitle="No strengths available"
                emptyDescription="Strength observations will appear when enough source information is available."
                onOpenEvidence={(title, evidence, generationType, confidence) => setEvidenceState({ title, evidence, generationType, confidence })}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Areas to verify"
            description="Recruiter-safe follow-up areas that may need confirmation during screening."
          >
            <StatementList
              items={result?.developmentAreas || []}
              emptyTitle="No observations available"
              emptyDescription="No follow-up observations were returned for this candidate profile."
              onOpenEvidence={(title, evidence, generationType, confidence) => setEvidenceState({ title, evidence, generationType, confidence })}
            />
          </SectionCard>

          <SectionCard
            title="Skill intelligence"
            description="Normalized skill groupings and evidence-backed keyword clusters."
          >
            <SkillIntelligence
              skills={result?.skills?.normalized || []}
              keywordClusters={result?.skills?.keywordClusters || []}
              onOpenEvidence={(title, evidence, generationType, confidence) => setEvidenceState({ title, evidence, generationType, confidence })}
            />
          </SectionCard>

          <SectionCard
            title="Career timeline"
            description="Chronological view of structured experience entries."
          >
            <CareerTimeline timeline={result?.timeline || []} />
          </SectionCard>

          <SectionCard
            title="Potential role alignment"
            description="AI suggestions only. These are not hiring decisions or automatic matches."
          >
            <StatementList
              items={result?.recommendedRoles || []}
              emptyTitle="No suggested roles"
              emptyDescription="Recommended role suggestions are not available for this profile."
              onOpenEvidence={(title, evidence, generationType, confidence) => setEvidenceState({ title, evidence, generationType, confidence })}
              renderTitle={(item) => item.role}
            />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Missing information"
            description="Deterministic follow-up items that can improve future candidate intelligence."
          >
            {result?.missingInformation?.length ? (
              <div className="space-y-3">
                {result.missingInformation.map((item) => (
                  <div key={item.code} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                    <p className="font-medium text-[var(--color-text)]">{item.label}</p>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.details}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">No major missing-information flags are currently recorded.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Profile completeness"
            description="Deterministic coverage of structured profile fields and resume availability."
          >
            <ProfileCompleteness profileCompleteness={result?.profileCompleteness} />
          </SectionCard>

          <SectionCard
            title="Quality and confidence"
            description="Quality represents the overall reliability of the result. Confidence applies to individual insights."
          >
            <div className="grid gap-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Overall quality</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatInsightPercentage(result?.quality?.score)}</p>
                  </div>
                  <Badge tone={qualityMeta.tone}>{qualityMeta.label}</Badge>
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Overall confidence</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatInsightScore(result?.confidence?.overallScore)}</p>
                  </div>
                  <Badge tone={confidenceMeta.tone}>{confidenceMeta.label}</Badge>
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                Deterministic coverage: {formatInsightScore(result?.confidence?.deterministicCoverage)} | AI signals: {result?.confidence?.aiSignalCount ?? 0}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Generation metadata"
            description="Recruiter-safe execution details for the current cached result."
          >
            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
              <p>Status: <span className="font-semibold text-[var(--color-text)]">{statusMeta.label}</span></p>
              <p>Generated: {formatInsightDate(result?.execution?.generatedAt)}</p>
              <p>AI enabled: {result?.execution?.aiEnabled ? 'Yes' : 'No'}</p>
              <p>Freshness: {result?.execution?.stale ? 'Stale result currently shown' : 'Current source-aligned result'}</p>
              <p>Source availability: {result?.snapshot?.resumeAvailable ? 'Resume available' : 'Structured profile only'}</p>
              {result?.warnings?.length ? <p>Warnings: {result.warnings.join(', ')}</p> : null}
            </div>
          </SectionCard>

          {showLimitedDataState ? (
            <SectionCard
              title="Limited data"
              description="This candidate profile needs more structured information for richer intelligence."
            >
              <EmptyState
                icon={AlertTriangle}
                title="Limited source information"
                description="Add or update resume and profile information to improve future intelligence runs."
                className="px-4 py-6"
              />
            </SectionCard>
          ) : null}
        </div>
      </div>

      <Dialog
        open={Boolean(evidenceState)}
        onClose={() => setEvidenceState(null)}
        title={evidenceState?.title || 'Evidence'}
        description="Evidence is limited to safe source references and redacted snippets."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {evidenceState?.confidence ? <ConfidenceBadge confidence={evidenceState.confidence} /> : null}
            {evidenceState?.generationType ? (
              <Badge tone={evidenceState.generationType === 'AI_GENERATED' ? 'info' : 'neutral'}>
                {evidenceState.generationType === 'AI_GENERATED' ? 'AI-generated' : 'Deterministic'}
              </Badge>
            ) : null}
          </div>
          {(evidenceState?.evidence || []).map((item) => (
            <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="neutral">{item.sourceType.replaceAll('_', ' ')}</Badge>
                <span className="text-xs text-[var(--color-text-muted)]">{item.fieldPath}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{redactEvidenceSnippet(item.snippet)}</p>
              {item.locator ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.locator}</p> : null}
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={confirmRegenerateOpen}
        onClose={() => setConfirmRegenerateOpen(false)}
        title="Regenerate candidate insights"
        description="This starts a new background intelligence run. The current cached result remains visible until the refresh completes."
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Regeneration refreshes the professional summary, strengths, observations, and role suggestions. It does not change the candidate profile or any hiring workflow automatically.
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setConfirmRegenerateOpen(false)} disabled={regenerating}>Cancel</Button>
          <Button type="button" onClick={handleRegenerate} loading={regenerating}>
            Confirm regeneration
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
