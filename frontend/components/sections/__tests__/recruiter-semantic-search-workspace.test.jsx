import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterSemanticSearchWorkspace } from '../recruiter-semantic-search-workspace';

const routerReplace = vi.fn();
const routerPush = vi.fn();
const toastPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
  }),
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

function makeSearchResponse(overrides = {}) {
  return {
    query: {
      originalQuery: 'java backend',
      normalizedQuery: 'java backend',
      mode: 'HYBRID',
      tokens: ['java', 'backend'],
      quotedPhrases: [],
      operators: [],
      terms: ['java', 'backend'],
      booleanAst: null,
      canonicalKeyword: 'java backend',
      filters: {
        certifications: [],
        skills: [],
        requiredSkills: [],
        optionalSkills: [],
        includeTerms: [],
        excludeTerms: [],
        exactPhrases: [],
      },
      expansionEnabled: true,
      transferableSkillsEnabled: true,
      warnings: [],
    },
    intent: {
      mode: 'HYBRID',
      semanticEnabled: true,
      keyword: 'java backend',
      filters: {
        certifications: [],
        skills: [],
        requiredSkills: [],
        optionalSkills: [],
        includeTerms: [],
        excludeTerms: [],
        exactPhrases: [],
      },
      role: null,
      seniority: null,
      years: { min: null, max: null },
      structuredFilters: [],
      warnings: [],
    },
    plan: {
      searchMode: 'HYBRID',
      retrievalStrategy: 'DATABASE',
      scoringMode: 'RETRIEVAL_PLUS_MATCH',
      semanticEnabled: true,
      expansionEnabled: true,
      transferableSkillsEnabled: true,
      jobContext: {
        jobId: 'cmjob12345678901234567890',
        similarJobId: null,
        similarCandidateId: null,
      },
      filters: {
        certifications: [],
        skills: [],
        requiredSkills: [],
        optionalSkills: [],
        includeTerms: [],
        excludeTerms: [],
        exactPhrases: [],
      },
      pagination: {
        page: 1,
        pageSize: 12,
      },
    },
    expansions: [],
    items: [
      {
        candidate: {
          id: 'candidate-1',
          fullName: 'Aarav Sharma',
          headline: 'Senior Backend Engineer',
          location: 'Bengaluru',
          totalExperience: 7,
          skills: ['Java', 'Spring Boot', 'AWS'],
          currentCompany: 'Northstar Systems',
          matchScore: 84,
        },
        retrieval: {
          score: 88,
          rank: 1,
          reasons: ['Strong required-skill coverage for Java and Spring Boot.'],
          matchedTerms: [
            { term: 'Java', type: 'SKILL' },
            { term: 'Spring Boot', type: 'SKILL' },
          ],
          expandedTerms: ['AWS'],
          transferableTerms: ['Microservices'],
          warnings: [],
          sourceChannels: ['STRUCTURED_FILTER', 'NORMALIZED_SKILL'],
        },
        match: {
          included: true,
          state: 'READY',
          matchStateId: 'match-state-1',
          matchResultId: 'match-result-1',
          generatedScore: 84,
          effectiveScore: 84,
          confidence: {
            score: 0.81,
            label: 'HIGH',
          },
          recommendation: 'STRONG_MATCH',
          stale: false,
        },
        metadata: {
          queryId: 'query123456789012345678901',
          executionId: 'execution12345678901234567',
          searchMode: 'HYBRID',
          generatedAt: '2026-07-29T09:00:00.000Z',
        },
        retrievalScore: 88,
        retrievalReasons: ['Strong required-skill coverage for Java and Spring Boot.'],
        matchedTerms: [
          { term: 'Java', type: 'SKILL' },
          { term: 'Spring Boot', type: 'SKILL' },
        ],
        expandedTerms: ['AWS'],
        transferableTerms: ['Microservices'],
        warnings: [],
      },
    ],
    execution: {
      queryId: 'query123456789012345678901',
      executionId: 'execution12345678901234567',
      status: 'READY',
      generatedAt: '2026-07-29T09:00:00.000Z',
      completedAt: '2026-07-29T09:00:03.000Z',
      resultCount: 1,
      executionTimeMs: 3000,
      warningCount: 0,
    },
    meta: {
      total: 1,
      page: 1,
      pageSize: 12,
      pageCount: 1,
      searchMode: 'HYBRID',
      warning: null,
    },
    warnings: [],
    ...overrides,
  };
}

function makeSavedSearch() {
  return {
    id: 'saved123456789012345678901',
    organisationId: 'org123456789012345678901',
    ownerUserId: 'user123456789012345678901',
    name: 'Java shortlist',
    description: 'Backend recruiter search',
    rawQuery: 'java backend',
    searchMode: 'HYBRID',
    filtersJson: {
      location: 'Bengaluru',
      requiredSkills: ['Java', 'Spring Boot'],
    },
    sourceCandidateId: null,
    sourceJobId: null,
    jobContextId: 'cmjob12345678901234567890',
    isShared: false,
    isActive: true,
    lastExecutedAt: '2026-07-29T08:40:00.000Z',
    createdAt: '2026-07-29T08:00:00.000Z',
    updatedAt: '2026-07-29T08:40:00.000Z',
  };
}

function makeHistoryResponse() {
  return {
    items: [
      {
        id: 'query123456789012345678901',
        organisationId: 'org123456789012345678901',
        createdByUserId: 'user123456789012345678901',
        rawQuery: 'java backend',
        normalizedQuery: 'java backend',
        searchMode: 'HYBRID',
        sourceCandidateId: null,
        sourceJobId: null,
        jobContextId: 'cmjob12345678901234567890',
        createdAt: '2026-07-29T08:55:00.000Z',
        latestExecution: {
          id: 'execution12345678901234567',
          organisationId: 'org123456789012345678901',
          queryId: 'query123456789012345678901',
          status: 'READY',
          candidatePoolFingerprint: 'pool-1',
          planJson: {},
          resultSummaryJson: {},
          resultCount: 1,
          executionTimeMs: 3000,
          warningCount: 0,
          errorCode: null,
          errorMessage: null,
          createdAt: '2026-07-29T08:55:00.000Z',
          completedAt: '2026-07-29T08:55:03.000Z',
        },
      },
    ],
    meta: {
      total: 1,
      page: 1,
      pageSize: 8,
      pageCount: 1,
    },
  };
}

function makeSuggestionsResponse() {
  return {
    suggestions: [
      { text: 'Java Spring Boot AWS', reason: 'Related backend skill cluster', source: 'EXPANSION' },
      { text: 'Java Microservices Kafka', reason: 'Recent recruiter search context', source: 'RECENT_SEARCH' },
    ],
  };
}

function makePreview() {
  return {
    id: 'candidate-1',
    fullName: 'Aarav Sharma',
    title: 'Senior Backend Engineer',
    location: 'Bengaluru',
    totalExperienceLabel: '7 yrs',
    currentCompany: 'Northstar Systems',
    resumeUrl: 'https://example.com/resume.pdf',
    skills: ['Java', 'Spring Boot', 'AWS'],
    aiSummary: 'Aarav Sharma is a backend engineer with strong Java and AWS experience.',
  };
}

function renderWorkspace(overrides = {}) {
  const initialState = {
    query: 'java backend',
    mode: 'HYBRID',
    jobId: 'cmjob12345678901234567890',
    location: '',
    locations: [],
    workMode: '',
    employmentType: '',
    education: '',
    currentEmployer: '',
    previousEmployer: '',
    requiredSkills: '',
    optionalSkills: '',
    minExperience: '',
    maxExperience: '',
    salaryMin: '',
    salaryMax: '',
    noticePeriodDaysMax: '',
    expansionEnabled: true,
    transferableSkillsEnabled: true,
    includeMatch: true,
    highConfidenceOnly: false,
    candidateName: '',
    deferSearch: false,
    ...(overrides.initialState || {}),
  };

  return render(
    <RecruiterSemanticSearchWorkspace
      initialState={initialState}
      organisationName="Careeriz Hire"
      jobs={[{ id: 'cmjob12345678901234567890', title: 'Senior Backend Engineer' }]}
      featureEnabled
      canRead
      canExecute
      canReadHistory
      canReadSavedSearches
      canManageSavedSearches
      canReadCandidateIntelligence={false}
      canReadCandidateMatch={false}
      candidateIntelligenceEnabled={false}
      candidateMatchingEnabled={false}
      searchSuggestionsEnabled
      savedSearchesEnabled
      searchHistoryEnabled
      similarCandidateSearchEnabled
      similarJobSearchEnabled
      {...overrides}
    />
  );
}

describe('RecruiterSemanticSearchWorkspace', () => {
  beforeEach(() => {
    toastPush.mockReset();
    routerReplace.mockReset();
    routerPush.mockReset();
    global.IntersectionObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    };

    global.fetch = vi.fn().mockImplementation((url, init = {}) => {
      const method = init.method || 'GET';

      if (url === '/api/intelligence/saved-searches' && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [makeSavedSearch()] }) });
      }
      if (url === '/api/intelligence/search/history?page=1&pageSize=8' && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeHistoryResponse() }) });
      }
      if (url === '/api/intelligence/search' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeSearchResponse() }) });
      }
      if (url === '/api/recruiter/candidates/candidate-1/preview' && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makePreview() }) });
      }
      if (url === '/api/intelligence/search/suggestions' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeSuggestionsResponse() }) });
      }
      if (url === '/api/intelligence/search/parse' && method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              keyword: 'Java Spring Boot AWS',
              location: 'Bengaluru',
              minExperience: 6,
              maxExperience: 10,
              skills: ['Java', 'Spring Boot', 'AWS'],
              parsedQuery: {
                mode: 'HYBRID',
                originalQuery: 'Java Spring Boot AWS Bengaluru',
                filters: {
                  requiredSkills: ['Java', 'Spring Boot', 'AWS'],
                  optionalSkills: ['Kafka'],
                },
              },
              interpretedFilters: ['Java', 'Bengaluru', '6-10 years'],
            },
          }),
        });
      }
      if (url === '/api/intelligence/saved-searches' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeSavedSearch() }) });
      }
      if (url === '/api/intelligence/saved-searches/saved123456789012345678901/execute' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeSearchResponse() }) });
      }
      if (url === '/api/intelligence/search/similar-candidate' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeSearchResponse() }) });
      }

      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the feature-disabled state', () => {
    renderWorkspace({ featureEnabled: false });
    expect(screen.getByText(/Resume Search is disabled/i)).toBeInTheDocument();
  });

  it('shows the permission-denied state', () => {
    renderWorkspace({ canRead: false });
    expect(screen.getByText(/do not have access to Resume Search/i)).toBeInTheDocument();
  });

  it('renders one unified search workspace without the legacy duplicate panels', async () => {
    renderWorkspace({ view: 'criteria' });

    expect(await screen.findByRole('heading', { name: 'AI Assist' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Candidate Results' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saved Searches' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recent Searches' })).toBeInTheDocument();
    expect(screen.queryByText('Reusable recruiter search presets stored on the backend.')).not.toBeInTheDocument();
    expect(screen.queryByText('Deterministic query suggestions from your current input, saved searches, and search context.')).not.toBeInTheDocument();
    expect(screen.queryByText('Live candidate preview')).not.toBeInTheDocument();
  });

  it('renders candidate results only on the dedicated results view', async () => {
    renderWorkspace({ view: 'results' });

    expect(await screen.findByRole('heading', { name: 'Candidate Results' })).toBeInTheDocument();
    expect((await screen.findAllByText('Aarav Sharma')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'AI Assist' })).not.toBeInTheDocument();
    expect(screen.queryByText('Live candidate preview')).not.toBeInTheDocument();
  });

  it('keeps criteria review separate from results and preview rendering', () => {
    renderWorkspace({
      view: 'criteria',
      initialState: { query: '', jobId: '', includeMatch: false },
    });

    expect(screen.getByRole('heading', { name: 'AI Assist' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Candidate Results' })).not.toBeInTheDocument();
    expect(screen.queryByText('Live candidate preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Aarav Sharma')).not.toBeInTheDocument();
  });

  it('serializes multiple normalized locations in the results navigation', () => {
    renderWorkspace({
      view: 'criteria',
      initialState: { query: 'engineer', jobId: '', includeMatch: false },
    });

    fireEvent.click(screen.getByRole('button', { name: /Bengaluru, Karnataka/i }));
    fireEvent.click(screen.getByRole('button', { name: /Chennai, Tamil Nadu/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Search Candidates' }));

    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('locations=Bengaluru%2C+Karnataka%2CChennai%2C+Tamil+Nadu'));
  });

  it('serializes supported Additional Details filters into the existing results route', async () => {
    renderWorkspace({ view: 'criteria', initialState: { query: 'java', jobId: '', includeMatch: false } });
    fireEvent.click(screen.getByText('Additional Details'));
    fireEvent.click(screen.getByLabelText('Permanent'));
    fireEvent.click(screen.getByLabelText('Full Time'));
    fireEvent.change(screen.getByLabelText('Search work permit countries'), { target: { value: 'Canada' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Canada' }));
    fireEvent.click(screen.getByLabelText('Verified email ID'));
    fireEvent.click(screen.getByLabelText('Attached resume'));
    fireEvent.change(screen.getByLabelText('Active in'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search Candidates' }));

    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('activeWithin=30'));
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('workPermitCountries=Canada'));
  });

  it('loads suggestions on demand', async () => {
    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /Suggestions/i }));

    expect(await screen.findByRole('button', { name: 'Java Spring Boot AWS' })).toBeInTheDocument();
  });

  it('interprets AI search into structured filters without auto-running search', async () => {
    renderWorkspace({
      view: 'criteria',
      initialState: {
        query: '',
        jobId: '',
        includeMatch: false,
      },
    });

    global.fetch.mockClear();

    fireEvent.change(screen.getByPlaceholderText(/Find a Java developer in Bengaluru/i), {
      target: { value: 'Find a Java developer in Bengaluru with Spring Boot and AWS, 6-10 years experience and maximum 30 days notice.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Interpret Search/i }));

    expect(await screen.findByRole('button', { name: /Apply filters/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));

    expect(screen.getByLabelText('Required skills')).toHaveValue('Java, Spring Boot, AWS');
    expect(screen.getByRole('button', { name: /Bengaluru ×/i })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/search/parse', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).not.toHaveBeenCalledWith('/api/intelligence/search', expect.objectContaining({ method: 'POST' }));
  });

  it('saves the current search through the proxy route', async () => {
    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /^Save Search$/i }));
    fireEvent.change(await screen.findByLabelText(/Search name/i), { target: { value: 'Backend shortlist' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Save search$/i }).at(-1));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/saved-searches', expect.objectContaining({ method: 'POST' })));
  });

  it('repopulates filters from saved and recent searches', async () => {
    renderWorkspace({
      initialState: {
        query: '',
        jobId: '',
        includeMatch: false,
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Saved Searches' }));
    fireEvent.click(await screen.findByRole('button', { name: /Java shortlist/i }));

    expect(screen.getByLabelText('Keywords')).toHaveValue('java backend');
    expect(screen.getByLabelText('Required skills')).toHaveValue('Java, Spring Boot');
    expect(routerReplace).toHaveBeenCalledWith(expect.stringContaining('/recruiter/database/results?'), { scroll: false });

    fireEvent.click(screen.getByRole('button', { name: 'Recent Searches' }));
    fireEvent.click(await screen.findByRole('button', { name: /java backend/i }));

    expect(screen.getByLabelText('Keywords')).toHaveValue('java backend');
  });

  it('submits the structured recruiter payload from Search Candidates', async () => {
    renderWorkspace({
      view: 'criteria',
      initialState: {
        query: '',
        jobId: '',
        includeMatch: false,
      },
    });

    global.fetch.mockClear();

    fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'power bi developer' } });
    fireEvent.change(screen.getByLabelText('Required skills'), { target: { value: 'Power BI, SQL' } });
    fireEvent.change(screen.getByLabelText('Min Experience'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Max Experience'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search Candidates' }));

    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('/recruiter/database/results?'));
    expect(routerPush.mock.calls[0][0]).toContain('requiredSkills=Power+BI%2C+SQL');
    expect(routerPush.mock.calls[0][0]).toContain('minExperience=4');
    expect(routerPush.mock.calls[0][0]).toContain('maxExperience=7');
  });

  it('paginates search results when requested', async () => {
    global.fetch = vi.fn().mockImplementation((url, init = {}) => {
      const method = init.method || 'GET';
      if (url === '/api/intelligence/saved-searches' && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [makeSavedSearch()] }) });
      }
      if (url === '/api/intelligence/search/history?page=1&pageSize=8' && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeHistoryResponse() }) });
      }
      if (url === '/api/intelligence/search' && method === 'POST') {
        const request = JSON.parse(init.body);
        const page = request.page || 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: makeSearchResponse({
              items: [
                {
                  ...makeSearchResponse().items[0],
                  candidate: {
                    ...makeSearchResponse().items[0].candidate,
                    id: `candidate-${page}`,
                    fullName: page === 1 ? 'Aarav Sharma' : 'Meera Nair',
                  },
                },
              ],
              meta: {
                total: 2,
                page,
                pageSize: 12,
                pageCount: 2,
                searchMode: 'HYBRID',
                warning: null,
              },
            }),
          }),
        });
      }
      if (String(url).startsWith('/api/recruiter/candidates/candidate-') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makePreview() }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Meera Nair')).toBeInTheDocument();
  });

  it('links each candidate name to the full recruiter profile route', async () => {
    renderWorkspace();

    const candidateLink = await screen.findByRole('link', { name: 'Aarav Sharma' });
    expect(candidateLink).toHaveAttribute(
      'href',
      '/recruiter/database/candidate-1?jobId=cmjob12345678901234567890&tab=ai-match&returnTo=%2Frecruiter%2Fdatabase%2Fresults%3Fq%3Djava%2Bbackend%26jobId%3Dcmjob12345678901234567890%26includeMatch%3Dtrue',
    );
  });

  it('supports pending polling through search history detail', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [makeSavedSearch()] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: makeHistoryResponse() }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: makeSearchResponse({
            execution: {
              ...makeSearchResponse().execution,
              status: 'PENDING',
            },
          }),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...makeHistoryResponse().items[0],
            executions: [
              {
                ...makeHistoryResponse().items[0].latestExecution,
                status: 'READY',
              },
            ],
          },
        }),
      });

    renderWorkspace();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/search/history/query123456789012345678901', expect.any(Object));
    vi.useRealTimers();
  });
});
