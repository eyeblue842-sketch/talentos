import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterAiJobDescriptionPanel } from '../recruiter-ai-job-description-panel';

const toastPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: routerRefresh,
  }),
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

function makeLiveJob(overrides = {}) {
  return {
    id: 'cmjob12345678901234567890',
    title: 'Senior Backend Engineer',
    description: 'Current live job description.',
    responsibilities: ['Own critical services'],
    skillsRequired: ['Node.js', 'AWS'],
    requirements: ['5+ years experience'],
    benefits: ['Health insurance'],
    ...overrides,
  };
}

function makeResult(overrides = {}) {
  return {
    jobId: 'cmjob12345678901234567890',
    kind: 'FULL_DESCRIPTION',
    summary: 'Build and operate modern backend services for a fast-moving product team.',
    responsibilities: [
      'Design and deliver backend services.',
      'Partner with product and platform teams.',
    ],
    requiredSkills: ['Node.js', 'PostgreSQL', 'AWS'],
    preferredSkills: ['SQS', 'Terraform'],
    screeningQuestions: ['How have you handled service scalability?'],
    assumptions: ['The team is hiring for a product backend role.'],
    exclusionaryWordingWarnings: ['Avoid unnecessary years-of-experience thresholds.'],
    missingFields: ['Compensation range not provided.'],
    interviewFocus: ['Distributed systems fundamentals'],
    execution: {
      stateId: 'cmstate1234567890123456789',
      executionId: 'cmexec12345678901234567890',
      resultId: 'cmresult123456789012345678',
      status: 'READY',
      cacheHit: true,
      stale: false,
      generatedAt: '2026-07-28T09:30:00.000Z',
      provider: 'MOCK',
      providerVersion: 'mock-provider-v1',
      model: 'mock-model',
      modelVersion: 'mock-model-v1',
      schemaVersion: '1.0.0',
      promptKey: 'JOB_DESCRIPTION_FULL',
      promptVersion: '1.0.0',
      resultVersion: 'job-description-v1',
      sourceVersion: 'job-description-source-v1',
      latencyMs: 28,
      inputTokens: 16,
      outputTokens: 22,
      estimatedCost: 0,
    },
    ...overrides,
  };
}

function makeStatus(overrides = {}) {
  return {
    jobId: 'cmjob12345678901234567890',
    kind: 'FULL_DESCRIPTION',
    status: 'READY',
    stale: false,
    generatedAt: '2026-07-28T09:30:00.000Z',
    latestExecutionId: 'cmexec12345678901234567890',
    latestResultId: 'cmresult123456789012345678',
    sourceVersion: 'job-description-source-v1',
    promptVersion: '1.0.0',
    resultVersion: 'job-description-v1',
    ...overrides,
  };
}

function makeDraft(overrides = {}) {
  return {
    id: 'cmdraft1234567890123456789',
    organisationId: 'cmorg12345678901234567890',
    jobId: 'cmjob12345678901234567890',
    versionGroupId: 'cmgroup1234567890123456789',
    version: 1,
    previousVersionId: null,
    status: 'DRAFT',
    isLatestVersion: true,
    title: 'Senior Backend Engineer Draft',
    content: {
      title: 'Senior Backend Engineer Draft',
      summary: 'Draft summary from saved draft.',
      responsibilities: ['Lead backend delivery'],
      requiredSkills: ['Node.js', 'AWS'],
      preferredSkills: ['Terraform'],
      screeningQuestions: ['Describe your AWS experience.'],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: ['Platform ownership'],
    },
    jobSnapshot: null,
    sourceStateId: 'cmstate1234567890123456789',
    sourceExecutionId: 'cmexec12345678901234567890',
    sourceResultId: 'cmresult123456789012345678',
    templateId: 'cmtemplate12345678901234567',
    templateVersionId: 'cmtemplatever1234567890123',
    approvedAt: null,
    approvedByUserId: null,
    appliedAt: null,
    appliedByUserId: null,
    createdByUserId: 'cmuser12345678901234567890',
    updatedByUserId: 'cmuser12345678901234567890',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    ...overrides,
  };
}

function makeTemplate(overrides = {}) {
  return {
    id: 'cmtemplate12345678901234567',
    organisationId: null,
    scope: 'SYSTEM',
    key: 'backend_default',
    name: 'Backend Default',
    description: 'System template',
    isActive: true,
    activeVersionId: 'cmtemplatever1234567890123',
    activatedAt: '2026-07-28T09:00:00.000Z',
    activatedByUserId: 'cmadmin1234567890123456789',
    archivedAt: null,
    createdAt: '2026-07-28T09:00:00.000Z',
    updatedAt: '2026-07-28T09:00:00.000Z',
    versions: [
      {
        id: 'cmtemplatever1234567890123',
        templateId: 'cmtemplate12345678901234567',
        version: 2,
        title: 'Backend Template Title',
        content: {
          title: 'Backend Template Title',
          summary: 'Template summary.',
          responsibilities: ['Template responsibility'],
          requiredSkills: ['Java'],
          preferredSkills: ['Kafka'],
          screeningQuestions: ['Template question'],
          assumptions: [],
          exclusionaryWordingWarnings: [],
          missingFields: [],
          interviewFocus: ['Template focus'],
        },
        schemaVersion: '1.0.0',
        promptKey: 'JOB_DESCRIPTION_FULL',
        promptVersion: '1.0.0',
        sourceResultId: null,
        createdByUserId: 'cmadmin1234567890123456789',
        createdAt: '2026-07-28T09:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function makeHistory(overrides = {}) {
  return {
    jobId: 'cmjob12345678901234567890',
    state: makeStatus(),
    drafts: [
      makeDraft(),
      makeDraft({
        id: 'cmdraft0234567890123456789',
        version: 2,
        previousVersionId: null,
        status: 'APPLIED',
        appliedAt: '2026-07-28T10:11:00.000Z',
        appliedByUserId: 'cmuser99999999999999999999',
        content: {
          ...makeDraft().content,
          summary: 'Older applied draft summary.',
          responsibilities: ['Earlier responsibility'],
        },
      }),
    ],
    generations: [
      {
        resultId: 'cmresult123456789012345678',
        executionId: 'cmexec12345678901234567890',
        status: 'SUCCEEDED',
        generatedAt: '2026-07-28T09:30:00.000Z',
        promptVersion: '1.0.0',
        resultVersion: 'job-description-v2',
        sourceFingerprint: 'fingerprint-1',
      },
      {
        resultId: 'cmresult223456789012345678',
        executionId: 'cmexec22345678901234567890',
        status: 'FAILED',
        generatedAt: '2026-07-28T08:30:00.000Z',
        promptVersion: '1.0.0',
        resultVersion: 'job-description-v2',
        sourceFingerprint: 'fingerprint-2',
      },
    ],
    ...overrides,
  };
}

function renderPanel(overrides = {}) {
  return render(
    <RecruiterAiJobDescriptionPanel
      jobId="cmjob12345678901234567890"
      initialResult={makeResult()}
      initialStatus={makeStatus()}
      initialDrafts={[makeDraft()]}
      initialTemplates={[makeTemplate()]}
      initialHistory={makeHistory()}
      initialLiveJob={makeLiveJob()}
      featureEnabled
      canRead
      canGenerate
      {...overrides}
    />
  );
}

describe('RecruiterAiJobDescriptionPanel', () => {
  beforeEach(() => {
    toastPush.mockReset();
    routerRefresh.mockReset();
    vi.useRealTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the ready AI job description workspace with draft editor', () => {
    renderPanel();

    expect(screen.getByText('AI Job Description')).toBeInTheDocument();
    expect(screen.getByText('Draft editor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Draft summary from saved draft.')).toBeInTheDocument();
    expect(screen.getByText('Generated AI content')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Activity feed')).toBeInTheDocument();
    expect(screen.getByText('Version preview')).toBeInTheDocument();
    expect(screen.getByText('Compare versions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
  });

  it('loads the job description when no initial result is supplied', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: makeResult() }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [makeTemplate()] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: makeHistory({ drafts: [], generations: [] }) }),
      });

    render(
      <RecruiterAiJobDescriptionPanel
        jobId="cmjob12345678901234567890"
        initialResult={null}
        initialStatus={null}
        initialDrafts={[]}
        initialTemplates={[]}
        initialHistory={null}
        initialLiveJob={makeLiveJob()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(await screen.findByDisplayValue(/Build and operate modern backend services/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/jobs/cmjob12345678901234567890', expect.any(Object));
  });

  it('shows an empty state when no generated content exists yet', () => {
    render(
      <RecruiterAiJobDescriptionPanel
        jobId="cmjob12345678901234567890"
        initialResult={null}
        initialStatus={makeStatus({ status: 'REVIEW_REQUIRED', latestResultId: null })}
        initialDrafts={[]}
        initialTemplates={[makeTemplate()]}
        initialLiveJob={makeLiveJob()}
        featureEnabled
        canRead
        canGenerate
      />
    );

    expect(screen.getByText(/No AI job description yet/i)).toBeInTheDocument();
  });

  it('shows pending state while preserving a previous successful result', () => {
    renderPanel({
      initialResult: makeResult({
        execution: { ...makeResult().execution, status: 'PENDING' },
      }),
      initialStatus: makeStatus({ status: 'PENDING' }),
    });

    expect(screen.getByText(/previous successful result stays visible/i)).toBeInTheDocument();
    expect(screen.getByText(/Build and operate modern backend services/i)).toBeInTheDocument();
  });

  it('shows failure state messaging', () => {
    renderPanel({
      initialResult: makeResult({
        execution: { ...makeResult().execution, status: 'FAILED' },
      }),
      initialStatus: makeStatus({ status: 'FAILED' }),
    });

    expect(screen.getByText(/latest generation attempt did not complete successfully/i)).toBeInTheDocument();
  });

  it('tracks dirty state and saves a draft', async () => {
    const savedDraft = makeDraft({
      id: 'cmdraft2234567890123456789',
      version: 2,
      status: 'DRAFT',
      title: 'Updated Draft Title',
      content: {
        ...makeDraft().content,
        title: 'Updated Draft Title',
        summary: 'Updated saved draft summary.',
      },
      updatedAt: '2026-07-28T10:05:00.000Z',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: savedDraft }),
    });

    renderPanel();

    fireEvent.change(screen.getByLabelText('Job Description'), {
      target: { value: 'Updated saved draft summary.' },
    });

    expect(screen.getByText('Pending Changes')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }));
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/job-description-drafts/cmdraft1234567890123456789', expect.any(Object));
    expect(screen.queryByText('Pending Changes')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Updated saved draft summary.')).toBeInTheDocument();
  });

  it('prevents save when validation fails', async () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText('Job Description'), {
      target: { value: '' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }));
      await Promise.resolve();
    });

    expect(screen.getByText(/Job description is required before saving/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('loads a selected template into the editor', async () => {
    renderPanel({ initialDrafts: [], initialHistory: makeHistory({ drafts: [] }) });

    fireEvent.change(screen.getByLabelText('Template'), {
      target: { value: 'cmtemplate12345678901234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Load template/i }));

    expect(screen.getByDisplayValue('Template summary.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Backend Template Title')).toBeInTheDocument();
  });

  it('opens apply confirmation and applies the draft successfully', async () => {
    const approvedDraft = makeDraft({
      id: 'cmdraft3234567890123456789',
      version: 2,
      status: 'APPROVED',
      approvedAt: '2026-07-28T10:10:00.000Z',
      approvedByUserId: 'cmuser12345678901234567890',
      updatedAt: '2026-07-28T10:10:00.000Z',
    });
    const appliedDraft = {
      draft: {
        ...approvedDraft,
        status: 'APPLIED',
        appliedAt: '2026-07-28T10:11:00.000Z',
        appliedByUserId: 'cmuser12345678901234567890',
      },
      jobId: 'cmjob12345678901234567890',
      applied: true,
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: approvedDraft }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: appliedDraft }),
      });

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Apply Draft/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Apply$/i }));
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/job-description-drafts/cmdraft1234567890123456789', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/job-description-drafts/cmdraft3234567890123456789/apply', expect.any(Object));
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('queues regeneration and polls until completion', async () => {
    const refreshedResult = makeResult({
      summary: 'Updated AI job description after regeneration.',
      execution: {
        ...makeResult().execution,
        cacheHit: false,
        generatedAt: '2026-07-28T09:35:00.000Z',
      },
    });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { jobId: 'cmjob12345678901234567890', status: 'PENDING' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: makeStatus({ status: 'READY' }) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: refreshedResult }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: makeHistory() }),
      });

    renderPanel();

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/jobs/cmjob12345678901234567890/regenerate', expect.any(Object));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Updated AI job description after regeneration/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/jobs/cmjob12345678901234567890/status', expect.any(Object));
  }, 15000);

  it('does not render when the feature flag is disabled', () => {
    const { container } = renderPanel({ featureEnabled: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the version preview and comparison from selected history', () => {
    renderPanel();

    expect(screen.getByText('Version preview')).toBeInTheDocument();
    expect(screen.getByText('Compare versions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Draft summary from saved draft.')).toBeInTheDocument();
  });

  it('switches preview when a history version is selected', async () => {
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Preview/i })[1]);
      await Promise.resolve();
    });

    expect(screen.getAllByText('Older applied draft summary.').length).toBeGreaterThan(0);
  });

  it('shows timeline and activity entries including failed generation', () => {
    renderPanel();

    expect(screen.getAllByText('Regenerated').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed generation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Template selected').length).toBeGreaterThan(0);
  });

  it('shows empty history and activity states when no versions exist', () => {
    renderPanel({
      initialDrafts: [],
      initialHistory: makeHistory({ drafts: [], generations: [] }),
    });

    expect(screen.getByText('No history yet')).toBeInTheDocument();
    expect(screen.getByText('No timeline activity yet')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText('Select a version to compare')).toBeInTheDocument();
  });

  it('hides editing controls when generation permission is denied', () => {
    const { rerender } = renderPanel({
      canRead: false,
      canGenerate: false,
    });

    expect(screen.getByText(/does not have permission to view AI job description generation/i)).toBeInTheDocument();

    rerender(
      <RecruiterAiJobDescriptionPanel
        jobId="cmjob12345678901234567890"
        initialResult={makeResult()}
        initialStatus={makeStatus()}
        initialDrafts={[makeDraft()]}
        initialTemplates={[makeTemplate()]}
        initialHistory={makeHistory()}
        initialLiveJob={makeLiveJob()}
        featureEnabled
        canRead
        canGenerate={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Save Draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply Draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Regenerate/i })).not.toBeInTheDocument();
  });
});
