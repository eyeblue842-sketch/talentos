import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateJobMatchPanel } from '../candidate-job-match-panel';

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
    candidateId: 'cmcandidate123456789012345',
    jobId: 'cmjob12345678901234567890',
    overallScore: {
      score: 86,
      label: 'HIGH',
      evidence: [{
        id: 'ev-overall',
        sourceType: 'CANDIDATE_PROFILE',
        sourceId: 'cmcandidate123456789012345',
        fieldPath: 'skills',
        snippet: 'Java Spring Boot AWS',
        confidence: { score: 0.9, label: 'HIGH' },
        generationType: 'DETERMINISTIC',
        locator: 'candidate.skills',
      }],
      generationType: 'DETERMINISTIC',
    },
    confidence: {
      score: 0.81,
      label: 'HIGH',
    },
    recommendation: {
      label: 'STRONG_MATCH',
      reason: {
        text: 'Required skills and relevant backend experience strongly align with the job.',
        confidence: { score: 0.84, label: 'HIGH' },
        evidence: [{
          id: 'ev-reason',
          sourceType: 'JOB',
          sourceId: 'cmjob12345678901234567890',
          fieldPath: 'skillsRequired',
          snippet: 'Java, Spring Boot, AWS',
          confidence: { score: 0.84, label: 'HIGH' },
          generationType: 'DETERMINISTIC',
          locator: 'job.skillsRequired',
        }],
        generationType: 'DETERMINISTIC',
      },
    },
    scoreBreakdown: {
      requiredSkills: { score: 92, weight: 0.3, label: 'HIGH', evidence: [{ id: 'ev-1', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'skillsRequired', snippet: 'Java', confidence: { score: 1, label: 'HIGH' }, generationType: 'DETERMINISTIC', locator: 'job.skillsRequired' }], generationType: 'DETERMINISTIC' },
      preferredSkills: { score: 70, weight: 0.1, label: 'MEDIUM', evidence: [{ id: 'ev-2', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'skillsPreferred', snippet: 'Kafka', confidence: { score: 0.7, label: 'MEDIUM' }, generationType: 'DETERMINISTIC', locator: 'job.skillsPreferred' }], generationType: 'DETERMINISTIC' },
      experience: { score: 88, weight: 0.15, label: 'HIGH', evidence: [{ id: 'ev-3', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'totalExperience', snippet: '7 years', confidence: { score: 1, label: 'HIGH' }, generationType: 'DETERMINISTIC', locator: 'candidate.totalExperience' }], generationType: 'DETERMINISTIC' },
      roleTitle: { score: 84, weight: 0.1, label: 'HIGH', evidence: [{ id: 'ev-4', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'currentTitle', snippet: 'Senior Backend Engineer', confidence: { score: 0.8, label: 'HIGH' }, generationType: 'DETERMINISTIC', locator: 'candidate.currentTitle' }], generationType: 'DETERMINISTIC' },
      location: { score: 80, weight: 0.08, label: 'MEDIUM', evidence: [{ id: 'ev-5', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'location', snippet: 'Bangalore', confidence: { score: 0.8, label: 'MEDIUM' }, generationType: 'DETERMINISTIC', locator: 'job.location' }], generationType: 'DETERMINISTIC' },
      workMode: { score: 75, weight: 0.05, label: 'MEDIUM', evidence: [{ id: 'ev-6', sourceType: 'JOB_DESCRIPTION', sourceId: 'jd-1', fieldPath: 'workplaceType', snippet: 'Hybrid', confidence: { score: 0.75, label: 'MEDIUM' }, generationType: 'DETERMINISTIC', locator: 'job.workplaceType' }], generationType: 'DETERMINISTIC' },
      employmentType: { score: 100, weight: 0.04, label: 'HIGH', evidence: [{ id: 'ev-7', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'employmentType', snippet: 'Full-time', confidence: { score: 1, label: 'HIGH' }, generationType: 'DETERMINISTIC', locator: 'job.employmentType' }], generationType: 'DETERMINISTIC' },
      noticePeriod: { score: 78, weight: 0.05, label: 'MEDIUM', evidence: [{ id: 'ev-8', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'noticePeriodDays', snippet: '30', confidence: { score: 0.78, label: 'MEDIUM' }, generationType: 'DETERMINISTIC', locator: 'candidate.noticePeriodDays' }], generationType: 'DETERMINISTIC' },
      compensation: { score: 76, weight: 0.07, label: 'MEDIUM', evidence: [{ id: 'ev-9', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'expectedCtcLpa', snippet: '24', confidence: { score: 0.76, label: 'MEDIUM' }, generationType: 'DETERMINISTIC', locator: 'candidate.expectedCtcLpa' }], generationType: 'DETERMINISTIC' },
      education: { score: 64, weight: 0.06, label: 'LOW', evidence: [{ id: 'ev-10', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'educationEntries[0]', snippet: 'B.Tech', confidence: { score: 0.64, label: 'LOW' }, generationType: 'DETERMINISTIC', locator: 'candidate.educationEntries[0]' }], generationType: 'DETERMINISTIC' },
    },
    skills: {
      matchedRequired: [{ skill: 'Java', rationale: 'Required skill present.', confidence: { score: 1, label: 'HIGH' }, evidence: [{ id: 'ev-skill-1', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'skills[0]', snippet: 'Java', confidence: { score: 1, label: 'HIGH' }, generationType: 'DETERMINISTIC', locator: 'candidate.skills[0]' }], generationType: 'DETERMINISTIC' }],
      matchedPreferred: [],
      missingRequired: [{ skill: 'Kafka', rationale: 'Not present.', confidence: { score: 0.7, label: 'MEDIUM' }, evidence: [{ id: 'ev-skill-2', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'skillsPreferred[0]', snippet: 'Kafka', confidence: { score: 0.7, label: 'MEDIUM' }, generationType: 'DETERMINISTIC', locator: 'job.skillsPreferred[0]' }], generationType: 'DETERMINISTIC' }],
      missingPreferred: [],
      transferable: [{ skill: 'Microservices', rationale: 'Related backend architecture experience.', confidence: { score: 0.73, label: 'MEDIUM' }, evidence: [{ id: 'ev-skill-3', sourceType: 'CANDIDATE_INTELLIGENCE', sourceId: 'ci-1', fieldPath: 'strengths[0]', snippet: 'Platform ownership', confidence: { score: 0.73, label: 'MEDIUM' }, generationType: 'AI_GENERATED', locator: 'candidateIntelligence.strengths[0]' }], generationType: 'AI_GENERATED' }],
    },
    strengths: [{
      text: 'Strong backend platform ownership with relevant cloud delivery evidence.',
      confidence: { score: 0.88, label: 'HIGH' },
      evidence: [{ id: 'ev-strength', sourceType: 'CANDIDATE_PROFILE', sourceId: 'candidate-1', fieldPath: 'headline', snippet: 'Senior Backend Engineer', confidence: { score: 0.88, label: 'HIGH' }, generationType: 'AI_GENERATED', locator: 'candidate.headline' }],
      generationType: 'AI_GENERATED',
    }],
    risks: [{
      text: 'Verify direct Kafka production exposure during interviews.',
      confidence: { score: 0.66, label: 'MEDIUM' },
      evidence: [{ id: 'ev-risk', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'skillsPreferred[0]', snippet: 'Kafka', confidence: { score: 0.66, label: 'MEDIUM' }, generationType: 'AI_GENERATED', locator: 'job.skillsPreferred[0]' }],
      generationType: 'AI_GENERATED',
    }],
    interviewFocus: [{
      text: 'Discuss system design tradeoffs for high-throughput backend services.',
      confidence: { score: 0.74, label: 'MEDIUM' },
      evidence: [{ id: 'ev-focus', sourceType: 'CANDIDATE_INTELLIGENCE', sourceId: 'ci-1', fieldPath: 'summary.professionalSummary', snippet: 'Platform delivery', confidence: { score: 0.74, label: 'MEDIUM' }, generationType: 'AI_GENERATED', locator: 'candidateIntelligence.summary.professionalSummary' }],
      generationType: 'AI_GENERATED',
    }],
    recruiterSummary: {
      text: 'A high-fit backend candidate with only a small preferred-skill gap to validate.',
      confidence: { score: 0.8, label: 'HIGH' },
      evidence: [{ id: 'ev-summary', sourceType: 'CANDIDATE_INTELLIGENCE', sourceId: 'ci-1', fieldPath: 'summary.professionalSummary', snippet: 'Senior backend engineer', confidence: { score: 0.8, label: 'HIGH' }, generationType: 'AI_GENERATED', locator: 'candidateIntelligence.summary.professionalSummary' }],
      generationType: 'AI_GENERATED',
    },
    knockoutResults: [{
      ruleKey: 'required-skills',
      triggered: false,
      reason: 'Required skill threshold satisfied.',
      profileVersion: 'profile-v1',
      evidence: [{ id: 'ev-ko', sourceType: 'JOB', sourceId: 'job-1', fieldPath: 'skillsRequired', snippet: 'Java', confidence: { score: 1, label: 'HIGH' }, generationType: 'DETERMINISTIC', locator: 'job.skillsRequired' }],
    }],
    warnings: ['Preferred Kafka skill is not confirmed.'],
    execution: {
      stateId: 'state-1',
      executionId: 'exec-1',
      resultId: 'result-1',
      status: 'READY',
      cacheHit: true,
      aiEnabled: true,
      stale: false,
      generatedAt: '2026-07-29T04:00:00.000Z',
      provider: 'MOCK',
      providerVersion: 'mock-v1',
      model: 'mock-model',
      modelVersion: 'mock-model-v1',
      schemaVersion: '1.0.0',
      promptKey: 'CANDIDATE_MATCH',
      promptVersion: '1.0.0',
      resultVersion: 'candidate-match-v1',
      sourceVersion: 'candidate-match-source-v1',
      latencyMs: 32,
      inputTokens: 12,
      outputTokens: 18,
      estimatedCost: 0,
    },
    effective: {
      overallScore: 86,
      recommendation: 'STRONG_MATCH',
      isKnockedOut: false,
      hasOverride: false,
    },
    overrides: [],
    ...overrides,
  };
}

function makeStatus(overrides = {}) {
  return {
    candidateId: 'cmcandidate123456789012345',
    jobId: 'cmjob12345678901234567890',
    status: 'READY',
    stale: false,
    aiEnabled: true,
    generatedAt: '2026-07-29T04:00:00.000Z',
    latestExecutionId: 'exec-1',
    latestResultId: 'result-1',
    sourceVersion: 'candidate-match-source-v1',
    promptVersion: '1.0.0',
    resultVersion: 'candidate-match-v1',
    ...overrides,
  };
}

describe('CandidateJobMatchPanel', () => {
  beforeEach(() => {
    toastPush.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the ready match workspace', () => {
    render(
      <CandidateJobMatchPanel
        candidateId="cmcandidate123456789012345"
        jobId="cmjob12345678901234567890"
        jobTitle="Senior Backend Engineer"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
        canOverride
      />
    );

    expect(screen.getByText('AI Match')).toBeInTheDocument();
    expect(screen.getAllByText('86%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Strong match').length).toBeGreaterThan(0);
    expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Matched Required Skills')).toBeInTheDocument();
    expect(screen.getByText(/Strong backend platform ownership/i)).toBeInTheDocument();
  });

  it('shows an empty state when no job context is available', () => {
    render(
      <CandidateJobMatchPanel
        candidateId="cmcandidate123456789012345"
        jobId={null}
        initialResult={null}
        initialStatus={null}
        featureEnabled
        canRead
        canGenerate
        canOverride={false}
      />
    );

    expect(screen.getByText(/Select a job to view AI Match/i)).toBeInTheDocument();
  });

  it('opens the override dialog and saves an override', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'override-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: makeResult({
            effective: {
              overallScore: 76,
              recommendation: 'MATCH',
              isKnockedOut: false,
              hasOverride: true,
            },
            overrides: [{
              id: 'override-1',
              type: 'SCORE_ADJUSTMENT',
              scoreDelta: -10,
              recommendationOverride: null,
              knockoutOverride: null,
              reason: 'Manual recruiter calibration.',
              notes: 'Validated against current ATS stage.',
              createdByUserId: 'user-1',
              createdAt: '2026-07-29T05:00:00.000Z',
            }],
          }),
        }),
      });

    render(
      <CandidateJobMatchPanel
        candidateId="cmcandidate123456789012345"
        jobId="cmjob12345678901234567890"
        jobTitle="Senior Backend Engineer"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        featureEnabled
        canRead
        canGenerate
        canOverride
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Override' }));
    fireEvent.change(screen.getByLabelText('Score adjustment'), { target: { value: '-10' } });
    fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Manual recruiter calibration.' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Validated against current ATS stage.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/intelligence/jobs/cmjob12345678901234567890/candidates/cmcandidate123456789012345/match/override',
      expect.objectContaining({ method: 'POST' }),
    ));
    expect(await screen.findByText(/Override Audit/i)).toBeInTheDocument();
    expect(await screen.findByText(/Manual recruiter calibration/i)).toBeInTheDocument();
  });

  it('shows the pending banner while preserving a previous result', () => {
    render(
      <CandidateJobMatchPanel
        candidateId="cmcandidate123456789012345"
        jobId="cmjob12345678901234567890"
        jobTitle="Senior Backend Engineer"
        initialResult={makeResult({ execution: { ...makeResult().execution, status: 'PENDING' } })}
        initialStatus={makeStatus({ status: 'PENDING' })}
        featureEnabled
        canRead
        canGenerate
        canOverride={false}
      />
    );

    expect(screen.getByText(/previous successful result stays visible/i)).toBeInTheDocument();
    expect(screen.getAllByText('86%').length).toBeGreaterThan(0);
  });
});
