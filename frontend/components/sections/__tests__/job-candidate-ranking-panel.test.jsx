import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobCandidateRankingPanel } from '../job-candidate-ranking-panel';

const toastPush = vi.fn();

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

function makeRanking(overrides = {}) {
  return {
    snapshot: {
      id: 'snapshot-1',
      organisationId: 'org-1',
      jobId: 'cmjob12345678901234567890',
      status: 'READY',
      candidatePoolFingerprint: 'pool-1',
      sourceFingerprint: 'source-1',
      sourceVersion: 'candidate-ranking-source-v1',
      schemaVersion: '1.0.0',
      scoringProfileVersionId: 'profile-version-1',
      latestExecutionId: 'exec-1',
      generatedAt: '2026-07-29T05:10:00.000Z',
      completedAt: '2026-07-29T05:11:00.000Z',
      staleReason: null,
      totalCandidates: 2,
      processedCandidates: 2,
      failedCandidates: 0,
      createdAt: '2026-07-29T05:10:00.000Z',
      updatedAt: '2026-07-29T05:11:00.000Z',
    },
    entries: [
      {
        id: 'entry-1',
        snapshotId: 'snapshot-1',
        organisationId: 'org-1',
        jobId: 'cmjob12345678901234567890',
        candidateId: 'candidate-1',
        matchStateId: 'match-state-1',
        matchResultId: 'match-result-1',
        rank: 1,
        generatedOverallScore: 88,
        effectiveOverallScore: 88,
        confidenceScore: 0.82,
        generatedRecommendation: 'STRONG_MATCH',
        effectiveRecommendation: 'STRONG_MATCH',
        fitBand: 'STRONG_MATCH',
        strengthSummary: 'Strong backend alignment.',
        gapSummary: 'Minor Kafka gap.',
        isKnockedOut: false,
        hasOverride: false,
        createdAt: '2026-07-29T05:10:00.000Z',
        updatedAt: '2026-07-29T05:11:00.000Z',
      },
      {
        id: 'entry-2',
        snapshotId: 'snapshot-1',
        organisationId: 'org-1',
        jobId: 'cmjob12345678901234567890',
        candidateId: 'candidate-2',
        matchStateId: 'match-state-2',
        matchResultId: 'match-result-2',
        rank: 2,
        generatedOverallScore: 61,
        effectiveOverallScore: 54,
        confidenceScore: 0.56,
        generatedRecommendation: 'PARTIAL_MATCH',
        effectiveRecommendation: 'PARTIAL_MATCH',
        fitBand: 'PARTIAL_MATCH',
        strengthSummary: 'Transferable backend fundamentals.',
        gapSummary: 'Required Spring Boot experience is limited.',
        isKnockedOut: true,
        hasOverride: true,
        createdAt: '2026-07-29T05:10:00.000Z',
        updatedAt: '2026-07-29T05:11:00.000Z',
      },
    ],
    meta: {
      total: 2,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    },
    ...overrides,
  };
}

function makeStatus(overrides = {}) {
  return {
    id: 'snapshot-1',
    organisationId: 'org-1',
    jobId: 'cmjob12345678901234567890',
    status: 'READY',
    candidatePoolFingerprint: 'pool-1',
    sourceFingerprint: 'source-1',
    sourceVersion: 'candidate-ranking-source-v1',
    schemaVersion: '1.0.0',
    scoringProfileVersionId: 'profile-version-1',
    latestExecutionId: 'exec-1',
    generatedAt: '2026-07-29T05:10:00.000Z',
    completedAt: '2026-07-29T05:11:00.000Z',
    staleReason: null,
    totalCandidates: 2,
    processedCandidates: 2,
    failedCandidates: 0,
    createdAt: '2026-07-29T05:10:00.000Z',
    updatedAt: '2026-07-29T05:11:00.000Z',
    ...overrides,
  };
}

describe('JobCandidateRankingPanel', () => {
  beforeEach(() => {
    toastPush.mockReset();
    vi.useRealTimers();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/api/recruiter/candidates/candidate-1/preview')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { fullName: 'Candidate One', title: 'Senior Backend Engineer' } }) });
      }
      if (String(url).includes('/api/recruiter/candidates/candidate-2/preview')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { fullName: 'Candidate Two', title: 'Backend Developer' } }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeRanking() }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ranking statistics and rows', async () => {
    render(
      <JobCandidateRankingPanel
        jobId="cmjob12345678901234567890"
        initialRanking={makeRanking()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText('AI Candidate Ranking')).toBeInTheDocument();
    expect(screen.getByText('Candidates Ranked')).toBeInTheDocument();
    expect(await screen.findByText('Candidate One')).toBeInTheDocument();
    expect(await screen.findByText('Candidate Two')).toBeInTheDocument();
    expect(screen.getByText('Strong backend alignment.')).toBeInTheDocument();
  });

  it('shows the feature-disabled state', () => {
    render(
      <JobCandidateRankingPanel
        jobId="cmjob12345678901234567890"
        initialRanking={null}
        initialStatus={null}
        featureEnabled={false}
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/AI Candidate Ranking is disabled/i)).toBeInTheDocument();
  });

  it('applies filters through the ranking API', async () => {
    render(
      <JobCandidateRankingPanel
        jobId="cmjob12345678901234567890"
        initialRanking={makeRanking()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    fireEvent.change(screen.getByLabelText('Recommendation'), { target: { value: 'STRONG_MATCH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/intelligence/jobs/cmjob12345678901234567890/ranking?page=1&pageSize=20&recommendation=STRONG_MATCH&sort=rank',
      expect.any(Object),
    ));
  });

  it('polls status while pending and refreshes the ranking snapshot after completion', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { fullName: 'Candidate One', title: 'Senior Backend Engineer' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { fullName: 'Candidate Two', title: 'Backend Developer' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: makeStatus({ status: 'READY' }) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: makeRanking() }) });

    render(
      <JobCandidateRankingPanel
        jobId="cmjob12345678901234567890"
        initialRanking={makeRanking({ snapshot: { ...makeRanking().snapshot, status: 'PENDING' } })}
        initialStatus={makeStatus({ status: 'PENDING' })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
      await Promise.resolve();
    });

    const calledUrls = global.fetch.mock.calls.map(([url]) => url);
    expect(calledUrls).toContain('/api/intelligence/jobs/cmjob12345678901234567890/ranking/status');
    expect(calledUrls).toContain('/api/intelligence/jobs/cmjob12345678901234567890/ranking?page=1&pageSize=20&sort=rank');
  }, 10000);
});
