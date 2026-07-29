"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CircleAlert,
  Filter,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  buildCandidateRankingSupportReference,
  CANDIDATE_RANKING_TERMINAL_STATUSES,
  formatMatchDate,
  formatMatchDecimal,
  getCandidateRankingStatusMeta,
  getRecommendationMeta,
  hasPreviousCandidateRankingSnapshot,
  mapCandidateRankingError,
  parseCandidateRankingResponse,
  parseCandidateRankingStatusResponse,
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

function RankingStatusBadge({ status }) {
  const meta = getCandidateRankingStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function StatCard({ label, value, description }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>
    </Card>
  );
}

function buildQueryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `?${search}` : '';
}

function averageScore(entries) {
  if (!entries.length) return '0%';
  const total = entries.reduce((sum, item) => sum + (item.effectiveOverallScore || 0), 0);
  return `${Math.round(total / entries.length)}%`;
}

function countWhere(entries, predicate) {
  return entries.filter(predicate).length;
}

export function JobCandidateRankingPanel({
  jobId,
  initialRanking = null,
  initialStatus = null,
  featureEnabled,
  canRead,
  canGenerate,
}) {
  const { push } = useToast();
  const parsedInitialRanking = useMemo(() => {
    if (!initialRanking) return null;
    try {
      return parseCandidateRankingResponse(initialRanking);
    } catch {
      return null;
    }
  }, [initialRanking]);
  const parsedInitialStatus = useMemo(() => {
    if (!initialStatus) return null;
    try {
      return parseCandidateRankingStatusResponse(initialStatus);
    } catch {
      return null;
    }
  }, [initialStatus]);

  const [ranking, setRanking] = useState(parsedInitialRanking);
  const [status, setStatus] = useState(parsedInitialStatus || parsedInitialRanking?.snapshot || null);
  const [loading, setLoading] = useState(!parsedInitialRanking && !parsedInitialStatus && featureEnabled && canRead);
  const [error, setError] = useState('');
  const [requestPending, setRequestPending] = useState(false);
  const [previewByCandidateId, setPreviewByCandidateId] = useState({});
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef(null);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    recommendation: '',
    status: '',
    minScore: '',
    minConfidence: '',
    knockedOut: '',
    candidate: '',
    sort: 'rank',
  });

  const activeStatus = status?.status || ranking?.snapshot?.status || null;
  const hasSnapshot = hasPreviousCandidateRankingSnapshot(ranking?.snapshot);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  async function loadRanking(nextFilters = filters) {
    const data = await requestJson(`/api/intelligence/jobs/${jobId}/ranking${buildQueryString(nextFilters)}`);
    return parseCandidateRankingResponse(data);
  }

  useEffect(() => {
    if (!featureEnabled || !canRead || parsedInitialRanking || parsedInitialStatus) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      loadRanking().catch(() => null),
      requestJson(`/api/intelligence/jobs/${jobId}/ranking/status`).catch(() => null),
    ])
      .then(([rankingData, statusData]) => {
        if (cancelled) return;
        if (rankingData) setRanking(rankingData);
        if (statusData) setStatus(parseCandidateRankingStatusResponse(statusData));
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(mapCandidateRankingError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, featureEnabled, jobId, parsedInitialRanking, parsedInitialStatus]);

  useEffect(() => {
    const ids = (ranking?.entries || []).map((item) => item.candidateId).filter((id) => !previewByCandidateId[id]);
    if (!ids.length) return undefined;

    let cancelled = false;
    Promise.all(ids.map(async (candidateId) => {
      try {
        const preview = await requestJson(`/api/recruiter/candidates/${candidateId}/preview`);
        return [candidateId, preview];
      } catch {
        return [candidateId, null];
      }
    })).then((records) => {
      if (cancelled) return;
      setPreviewByCandidateId((current) => {
        const next = { ...current };
        records.forEach(([candidateId, preview]) => {
          next[candidateId] = preview;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [previewByCandidateId, ranking?.entries]);

  useEffect(() => {
    if (!featureEnabled || !canRead) return undefined;
    if (!activeStatus || CANDIDATE_RANKING_TERMINAL_STATUSES.has(activeStatus)) {
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
        const nextStatus = parseCandidateRankingStatusResponse(await requestJson(`/api/intelligence/jobs/${jobId}/ranking/status`));
        if (cancelled) return;
        setStatus(nextStatus);

        if (CANDIDATE_RANKING_TERMINAL_STATUSES.has(nextStatus.status)) {
          setPolling(false);
          const nextRanking = await loadRanking(filters);
          if (!cancelled) setRanking(nextRanking);
          return;
        }
      } catch (caught) {
        if (!cancelled) {
          setError(mapCandidateRankingError(caught));
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
  }, [activeStatus, canRead, featureEnabled, filters, jobId]);

  async function refreshData(nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const [rankingData, statusData] = await Promise.all([
        loadRanking(nextFilters),
        requestJson(`/api/intelligence/jobs/${jobId}/ranking/status`).then(parseCandidateRankingStatusResponse).catch(() => null),
      ]);
      setRanking(rankingData);
      if (statusData) setStatus(statusData);
    } catch (caught) {
      setError(mapCandidateRankingError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(path) {
    setRequestPending(true);
    setError('');
    try {
      const response = await requestJson(`/api/intelligence/jobs/${jobId}/ranking/${path}`, {
        method: 'POST',
        body: JSON.stringify({ forceRegenerate: true }),
      });
      setStatus(parseCandidateRankingStatusResponse(response));
      push({ tone: 'success', message: path === 'refresh' ? 'Ranking refresh started.' : 'Ranking generation started.' });
    } catch (caught) {
      const message = mapCandidateRankingError(caught);
      setError(message);
      push({ tone: 'danger', message });
    } finally {
      setRequestPending(false);
    }
  }

  const entries = ranking?.entries || [];
  const meta = ranking?.meta || { page: 1, pageSize: 20, total: 0, pageCount: 1 };
  const visibleStrongMatches = countWhere(entries, (item) => item.effectiveRecommendation === 'STRONG_MATCH');
  const visiblePartialMatches = countWhere(entries, (item) => item.effectiveRecommendation === 'PARTIAL_MATCH');
  const visibleKnockouts = countWhere(entries, (item) => item.isKnockedOut);
  const visibleHighConfidence = countWhere(entries, (item) => (item.confidenceScore || 0) >= 0.75);

  if (!featureEnabled) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="AI Candidate Ranking is disabled"
          description="This recruiter workspace hides ranking when the feature flag is turned off."
        />
      </Card>
    );
  }

  if (!canRead) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="You do not have access to AI Candidate Ranking"
          description="A recruiter with candidate ranking read access can review persisted rankings for this job."
        />
      </Card>
    );
  }

  if (loading && !ranking && !status) {
    return (
      <Card>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  if (!hasSnapshot && !entries.length && ['FAILED', 'DISABLED'].includes(activeStatus || '')) {
    const metaStatus = getCandidateRankingStatusMeta(activeStatus);
    return (
      <Card>
        <EmptyState
          icon={activeStatus === 'FAILED' ? AlertTriangle : CircleAlert}
          title={metaStatus.label}
          description={metaStatus.description}
          primaryAction={canGenerate ? { label: 'Generate ranking', onClick: () => handleGenerate('generate') } : null}
        />
      </Card>
    );
  }

  if (!hasSnapshot && !entries.length && activeStatus === 'PENDING') {
    return (
      <Card>
        <EmptyState
          icon={Sparkles}
          title="Generating the first candidate ranking snapshot"
          description="The ranking engine is processing this job in the background. The page updates automatically when candidate results are ready."
        />
      </Card>
    );
  }

  if (!hasSnapshot && !entries.length) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="No AI ranking snapshot yet"
          description="Generate a ranking snapshot to review persisted candidate ordering, fit summaries, and confidence signals for this job."
          primaryAction={canGenerate ? { label: 'Generate ranking', onClick: () => handleGenerate('generate') } : null}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-semibold text-[var(--color-text)]">AI Candidate Ranking</h3>
              <RankingStatusBadge status={activeStatus} />
              {polling ? <Badge tone="info">Polling for updates</Badge> : null}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Persisted ranking snapshots reuse the candidate match engine. The table below reflects backend-generated ordering, effective overrides, and recruiter-safe summaries.
            </p>
            {activeStatus === 'PENDING' && hasSnapshot ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">The previous successful ranking snapshot stays visible while refresh processing continues.</p>
            ) : null}
            {activeStatus === 'STALE' ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Job, candidate-pool, or scoring inputs changed after this snapshot was generated.</p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-amber-700">{error}</p> : null}
          </div>
          <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
            <p>Generated: {formatMatchDate(status?.generatedAt || ranking?.snapshot?.generatedAt)}</p>
            <p>Completed: {formatMatchDate(ranking?.snapshot?.completedAt)}</p>
            <p>Progress: {ranking?.snapshot?.processedCandidates || 0}/{ranking?.snapshot?.totalCandidates || 0}</p>
            <p>Support: {buildCandidateRankingSupportReference(ranking?.snapshot || status) || 'Not available'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => refreshData()} disabled={loading}>
                Refresh
              </Button>
              {canGenerate ? (
                <Button type="button" size="sm" loading={requestPending} onClick={() => handleGenerate(hasSnapshot ? 'refresh' : 'generate')} leadingIcon={RefreshCcw}>
                  {hasSnapshot ? 'Refresh ranking' : 'Generate ranking'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Candidates Ranked" value={ranking?.snapshot?.totalCandidates || 0} description="Total candidates captured in the current snapshot." />
        <StatCard label="Average Match" value={averageScore(entries)} description="Average effective score across the currently loaded result set." />
        <StatCard label="Strong Matches" value={visibleStrongMatches} description="Visible candidates currently labelled strong match." />
        <StatCard label="Partial Matches" value={visiblePartialMatches} description="Visible candidates currently labelled partial match." />
        <StatCard label="Knockouts" value={visibleKnockouts} description="Visible candidates currently marked knocked out." />
        <StatCard label="High Confidence" value={visibleHighConfidence} description="Visible candidates with confidence score at or above 75%." />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-[var(--color-text)]">Ranking Filters</h4>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Filters are executed by the backend ranking API. No candidate-job fit logic is recalculated in the browser.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = {
                page: 1,
                pageSize: 20,
                recommendation: '',
                status: '',
                minScore: '',
                minConfidence: '',
                knockedOut: '',
                candidate: '',
                sort: 'rank',
              };
              setFilters(next);
              refreshData(next);
            }}
          >
            Reset filters
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Recommendation
            <select className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.recommendation} onChange={(event) => setFilters((current) => ({ ...current, recommendation: event.target.value, page: 1 }))}>
              <option value="">All</option>
              <option value="STRONG_MATCH">Strong match</option>
              <option value="MATCH">Match</option>
              <option value="PARTIAL_MATCH">Partial match</option>
              <option value="LIMITED_MATCH">Limited match</option>
              <option value="REVIEW_REQUIRED">Review required</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Status
            <select className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
              <option value="">All</option>
              <option value="READY">Ready</option>
              <option value="PENDING">Pending</option>
              <option value="STALE">Stale</option>
              <option value="FAILED">Failed</option>
              <option value="DISABLED">Disabled</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Minimum Score
            <input type="number" min="0" max="100" className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.minScore} onChange={(event) => setFilters((current) => ({ ...current, minScore: event.target.value, page: 1 }))} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Minimum Confidence
            <input type="number" min="0" max="1" step="0.05" className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.minConfidence} onChange={(event) => setFilters((current) => ({ ...current, minConfidence: event.target.value, page: 1 }))} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Knockout
            <select className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.knockedOut} onChange={(event) => setFilters((current) => ({ ...current, knockedOut: event.target.value, page: 1 }))}>
              <option value="">All</option>
              <option value="true">Knocked out</option>
              <option value="false">Not knocked out</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Candidate Name
            <input className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.candidate} onChange={(event) => setFilters((current) => ({ ...current, candidate: event.target.value, page: 1 }))} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Sort
            <select className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value, page: 1 }))}>
              <option value="rank">Rank</option>
              <option value="score">Score</option>
              <option value="confidence">Confidence</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => refreshData({ ...filters, page: 1 })} leadingIcon={Filter}>
              Apply filters
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Overall Score</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Recommendation</th>
                <th className="px-4 py-3">Strength Summary</th>
                <th className="px-4 py-3">Gap Summary</th>
                <th className="px-4 py-3">Knockout</th>
                <th className="px-4 py-3">Override</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!entries.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8">
                    <EmptyState
                      icon={BarChart3}
                      title="No ranking rows for this view"
                      description="Adjust the current filters or regenerate the ranking snapshot to review candidate ordering."
                      className="border-none p-0"
                    />
                  </td>
                </tr>
              ) : entries.map((entry) => {
                const preview = previewByCandidateId[entry.candidateId];
                const candidateName = preview?.fullName || preview?.name || `Candidate ${entry.candidateId.slice(-6)}`;
                const candidateTitle = preview?.title || preview?.currentTitle || preview?.headline || 'Candidate profile';
                return (
                  <tr key={entry.id} className="border-b border-[var(--color-border)] align-top">
                    <td className="px-4 py-4 text-sm font-semibold text-[var(--color-text)]">{entry.rank}</td>
                    <td className="px-4 py-4">
                      <div className="min-w-[12rem]">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{candidateName}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{candidateTitle}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-[var(--color-text)]">{entry.effectiveOverallScore}%</td>
                    <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{entry.confidenceScore == null ? 'Not available' : formatMatchDecimal(entry.confidenceScore)}</td>
                    <td className="px-4 py-4"><Badge tone={getRecommendationMeta(entry.effectiveRecommendation).tone}>{getRecommendationMeta(entry.effectiveRecommendation).label}</Badge></td>
                    <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{entry.strengthSummary || 'Not available'}</td>
                    <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{entry.gapSummary || 'Not available'}</td>
                    <td className="px-4 py-4">
                      <Badge tone={entry.isKnockedOut ? 'danger' : 'success'}>{entry.isKnockedOut ? 'Knocked out' : 'Eligible'}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={entry.hasOverride ? 'warning' : 'neutral'}>{entry.hasOverride ? 'Applied' : 'None'}</Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{formatMatchDate(ranking?.snapshot?.generatedAt)}</td>
                    <td className="px-4 py-4">
                      <Button as={Link} href={`/recruiter/database/${entry.candidateId}?jobId=${jobId}&tab=ai-match`} variant="outline" size="sm">
                        Open AI Match
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] px-4 py-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Page {meta.page} of {meta.pageCount} · {meta.total} candidate{meta.total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || loading}
              onClick={() => {
                const next = { ...filters, page: Math.max(1, meta.page - 1) };
                setFilters(next);
                refreshData(next);
              }}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.pageCount || loading}
              onClick={() => {
                const next = { ...filters, page: Math.min(meta.pageCount, meta.page + 1) };
                setFilters(next);
                refreshData(next);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
