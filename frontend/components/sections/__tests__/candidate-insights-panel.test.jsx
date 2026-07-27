import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateInsightsPanel } from '../candidate-insights-panel';

const toastPush = vi.fn();

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

function makeResult(overrides = {}) {
  return {
    summary: {
      professionalSummary: {
        text: 'Senior backend engineer with strong Spring Boot, AWS, and mentoring experience.',
        confidence: { score: 0.87, label: 'HIGH' },
        evidence: [{ id: 'ev-summary', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'summary', snippet: 'Built production systems with React and Spring Boot.', locator: 'candidate.summary' }],
        generationType: 'AI_GENERATED',
      },
      roleThemes: [],
    },
    snapshot: {
      candidateId: 'candidate-1',
      fullName: 'Candidate Person',
      currentTitle: 'Senior Engineer',
      currentEmployer: 'Acme Labs',
      location: 'Bangalore',
      totalExperience: 7,
      resumeAvailable: true,
      latestResumeAssetId: 'resume-1',
      resumeLastUpdatedAt: '2026-07-27T10:00:00.000Z',
      structuredCounts: {
        skills: 4,
        experienceEntries: 2,
        educationEntries: 1,
        certificationEntries: 1,
        projectEntries: 1,
        languageEntries: 2,
      },
      freshness: {
        candidateUpdatedAt: '2026-07-27T10:00:00.000Z',
        resumeUpdatedAt: '2026-07-27T10:00:00.000Z',
        importUpdatedAt: '2026-07-27T10:00:00.000Z',
      },
    },
    skills: {
      normalized: [
        { name: 'Java', aliases: ['Java'] },
        { name: 'Spring Boot', aliases: ['SpringBoot', 'Spring Framework'] },
        { name: 'AWS', aliases: ['AWS Cloud'] },
        { name: 'Docker', aliases: ['Docker'] },
      ],
      keywordClusters: [
        {
          text: 'Backend platform delivery',
          confidence: { score: 0.72, label: 'MEDIUM' },
          evidence: [{ id: 'ev-cluster', sourceType: 'RESUME_ASSET', sourceId: 'resume-1', fieldPath: 'parsedText', snippet: 'React Spring Boot AWS', locator: 'resumeAsset.parsedText' }],
          generationType: 'AI_GENERATED',
        },
      ],
    },
    timeline: [
      {
        id: 'timeline-1',
        company: 'Acme Labs',
        title: 'Senior Engineer',
        startDate: '2022-01-01',
        endDate: null,
        currentlyWorking: true,
        location: 'Bangalore',
      },
    ],
    strengths: [
      {
        text: 'Demonstrated backend platform ownership in cloud-hosted production environments.',
        confidence: { score: 0.91, label: 'HIGH' },
        evidence: [{ id: 'ev-strength', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'experienceEntries[0]', snippet: 'Senior Engineer at Acme Labs', locator: 'candidate.experienceEntries[0]' }],
        generationType: 'AI_GENERATED',
      },
    ],
    developmentAreas: [
      {
        text: 'Verify the depth of recent people-management responsibilities.',
        confidence: { score: 0.58, label: 'MEDIUM' },
        evidence: [{ id: 'ev-observation', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'summary', snippet: 'Mentoring', locator: 'candidate.summary' }],
        generationType: 'AI_GENERATED',
      },
    ],
    recommendedRoles: [
      {
        role: 'Staff Backend Engineer',
        rationale: 'Strong cloud backend and architecture evidence aligns with senior IC platform roles.',
        confidence: { score: 0.79, label: 'MEDIUM' },
        evidence: [{ id: 'ev-role', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'skills', snippet: 'Spring Boot, AWS', locator: 'candidate.skills' }],
        generationType: 'AI_GENERATED',
      },
    ],
    missingInformation: [
      { code: 'NOTICE_PERIOD', label: 'Notice period unavailable', details: 'Notice period was not available in structured profile data.' },
    ],
    profileCompleteness: {
      score: 82,
      label: 'HIGH',
      missingFields: ['Notice period unavailable'],
    },
    confidence: {
      overallScore: 0.78,
      overallLabel: 'MEDIUM',
      deterministicCoverage: 0.8,
      aiSignalCount: 4,
    },
    quality: {
      score: 84,
      label: 'HIGH',
    },
    warnings: ['Notice period unavailable'],
    execution: {
      stateId: 'state-1',
      executionId: 'exec-1',
      resultId: 'result-1',
      status: 'READY',
      cacheHit: true,
      aiEnabled: true,
      stale: false,
      generatedAt: '2026-07-27T10:00:00.000Z',
      provider: 'MOCK',
      providerVersion: 'provider:mock-v1',
      model: 'mock-model',
      modelVersion: 'mock-model',
      parserVersion: 'import-parser-v1',
      schemaVersion: '1.0.0',
      promptKey: 'CANDIDATE_INTELLIGENCE_PROFILE',
      promptVersion: '1.0.0',
      resultVersion: 'candidate-intelligence-v1',
      sourceVersion: 'candidate-intelligence-source-v1',
      latencyMs: 34,
      inputTokens: 14,
      outputTokens: 9,
      estimatedCost: 0,
    },
    ...overrides,
  };
}

function makeStatus(overrides = {}) {
  return {
    candidateId: 'candidate-1',
    kind: 'PROFILE_OVERVIEW',
    status: 'READY',
    stale: false,
    aiEnabled: true,
    generatedAt: '2026-07-27T10:00:00.000Z',
    latestExecutionId: 'exec-1',
    latestResultId: 'result-1',
    sourceVersion: 'candidate-intelligence-source-v1',
    promptVersion: '1.0.0',
    resultVersion: 'candidate-intelligence-v1',
    ...overrides,
  };
}

describe('CandidateInsightsPanel', () => {
  beforeEach(() => {
    toastPush.mockReset();
    vi.useRealTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ready intelligence, summary, snapshot facts, strengths, observations, skills, timeline, roles, and completeness', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText('Candidate Insights')).toBeInTheDocument();
    expect(screen.getByText(/Senior backend engineer with strong Spring Boot/i)).toBeInTheDocument();
    expect(screen.getByText('Profile snapshot')).toBeInTheDocument();
    expect(screen.getAllByText('Senior Engineer').length).toBeGreaterThan(0);
    expect(screen.getByText(/Demonstrated backend platform ownership/i)).toBeInTheDocument();
    expect(screen.getByText(/Verify the depth of recent people-management responsibilities/i)).toBeInTheDocument();
    expect(screen.getByText('Programming Languages')).toBeInTheDocument();
    expect(screen.getByText('Spring Boot')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Labs').length).toBeGreaterThan(0);
    expect(screen.getByText('Staff Backend Engineer')).toBeInTheDocument();
    expect(screen.getAllByText('Notice period unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('84%')).toBeInTheDocument();
  });

  it('opens the evidence drawer for an insight', async () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /View evidence/i })[0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Built production systems with React and Spring Boot/i)).toBeInTheDocument();
    expect(screen.getByText(/candidate.summary/i)).toBeInTheDocument();
  });

  it('shows the stale banner while preserving the previous successful result', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({ execution: { ...makeResult().execution, status: 'STALE', stale: true } })}
        initialStatus={makeStatus({ status: 'STALE', stale: true })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/Candidate information changed after the current insights were generated/i)).toBeInTheDocument();
    expect(screen.getByText(/Senior backend engineer with strong Spring Boot/i)).toBeInTheDocument();
  });

  it('shows a generation panel when pending without a previous result', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({
          execution: { ...makeResult().execution, status: 'PENDING', resultId: null, cacheHit: false },
        })}
        initialStatus={makeStatus({ status: 'PENDING', latestResultId: null })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/Generating the first candidate insights result/i)).toBeInTheDocument();
  });

  it('shows a non-blocking pending banner when regenerating with a previous result', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({ execution: { ...makeResult().execution, status: 'PENDING' } })}
        initialStatus={makeStatus({ status: 'PENDING' })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/The previous successful result stays visible/i)).toBeInTheDocument();
    expect(screen.getByText(/Senior backend engineer with strong Spring Boot/i)).toBeInTheDocument();
  });

  it('shows failure messaging while preserving the previous result', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({ execution: { ...makeResult().execution, status: 'FAILED' } })}
        initialStatus={makeStatus({ status: 'FAILED' })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/The latest generation attempt did not complete successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/Senior backend engineer with strong Spring Boot/i)).toBeInTheDocument();
  });

  it('shows the deterministic-only banner when AI is disabled', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({
          summary: {
            professionalSummary: {
              text: 'Deterministic baseline only.',
              confidence: { score: 0.46, label: 'LOW' },
              evidence: [{ id: 'ev-base', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'headline', snippet: 'Senior Engineer', locator: 'candidate.headline' }],
              generationType: 'DETERMINISTIC',
            },
            roleThemes: [],
          },
          execution: { ...makeResult().execution, status: 'DISABLED', aiEnabled: false, provider: 'DISABLED', resultId: 'result-1' },
        })}
        initialStatus={makeStatus({ status: 'DISABLED', aiEnabled: false })}
        featureEnabled
        canRead
        canGenerate={false}
      />
    );

    expect(screen.getByText(/AI-generated insights are currently unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic baseline only/i)).toBeInTheDocument();
  });

  it('shows the review-required limited-data state', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({
          summary: {
            professionalSummary: {
              text: 'Candidate Person is currently positioned as a professional.',
              confidence: { score: 0.42, label: 'LOW' },
              evidence: [{ id: 'ev-limited', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'fullName', snippet: 'Candidate Person', locator: 'candidate.fullName' }],
              generationType: 'DETERMINISTIC',
            },
            roleThemes: [],
          },
          skills: { normalized: [], keywordClusters: [] },
          timeline: [],
          strengths: [],
          developmentAreas: [],
          recommendedRoles: [],
          execution: { ...makeResult().execution, status: 'REVIEW_REQUIRED' },
        })}
        initialStatus={makeStatus({ status: 'REVIEW_REQUIRED' })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getAllByText(/Limited source information/i).length).toBeGreaterThan(0);
  });

  it('hides regenerate action when generate permission is denied', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Regenerate insights/i })).not.toBeInTheDocument();
  });

  it('shows unavailable states when the feature is disabled or read access is denied', () => {
    const { rerender } = render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled={false}
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/disabled for this frontend environment/i)).toBeInTheDocument();

    rerender(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead={false}
        canGenerate={false}
      />
    );

    expect(screen.getByText(/does not have permission to view candidate intelligence/i)).toBeInTheDocument();
  });

  it('regenerates and polls until completion', async () => {
    const refreshedResult = makeResult({
      summary: {
        professionalSummary: {
          text: 'Updated summary after regeneration.',
          confidence: { score: 0.88, label: 'HIGH' },
          evidence: [{ id: 'ev-refresh', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'summary', snippet: 'Updated summary source', locator: 'candidate.summary' }],
          generationType: 'AI_GENERATED',
        },
        roleThemes: [],
      },
      execution: { ...makeResult().execution, cacheHit: false, generatedAt: '2026-07-27T10:05:00.000Z' },
    });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { candidateId: 'candidate-1', status: 'PENDING', aiEnabled: true, execution: { stale: false } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: makeStatus({ status: 'READY' }) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: refreshedResult }),
      });

    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Regenerate insights/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm regeneration/i }));
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/candidates/candidate-1/regenerate', expect.any(Object));
    expect(screen.getByText(/The previous successful result stays visible/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Updated summary after regeneration/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/candidates/candidate-1/status', expect.any(Object));
  }, 15000);

  it('shows a polling timeout message after the bounded interval', async () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: makeStatus({ status: 'PENDING', latestResultId: null }) }),
    });

    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={makeResult({
          execution: { ...makeResult().execution, status: 'PENDING', resultId: null, cacheHit: false },
        })}
        initialStatus={makeStatus({ status: 'PENDING', latestResultId: null })}
        featureEnabled
        canRead
        canGenerate
      />
    );

    await act(async () => {
      nowSpy.mockReturnValue(121000);
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByText(/still processing\. Use manual refresh to check again/i)).toBeInTheDocument();
  }, 15000);

  it('does not render raw provider output fields', () => {
    render(
      <CandidateInsightsPanel
        candidateId="candidate-1"
        initialResult={{ ...makeResult(), rawText: 'secret provider payload' }}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.queryByText(/secret provider payload/i)).not.toBeInTheDocument();
  });
});
