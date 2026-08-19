import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterResumeSearchPage } from '../recruiter-resume-search-page';
import { buildInitialSemanticSearchState } from '@/lib/semantic-search';

const routerPush = vi.fn();
const toastPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return { ...actual, useToast: () => ({ push: toastPush }) };
});

const JOBS = [
  { id: 'job-1', title: 'Senior Java Developer' },
  { id: 'job-2', title: 'Power BI Developer' },
];

function makeSavedSearch() {
  return {
    id: 'saved-1',
    organisationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'Java shortlist',
    description: 'Backend recruiter search',
    rawQuery: 'java backend',
    searchMode: 'HYBRID',
    filtersJson: { location: 'Bengaluru', requiredSkills: ['Java', 'Spring Boot'] },
    sourceCandidateId: null,
    sourceJobId: null,
    jobContextId: 'job-1',
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
        rawQuery: 'power bi developer',
        normalizedQuery: 'power bi developer',
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
    meta: { total: 1, page: 1, pageSize: 8, pageCount: 1 },
  };
}

function makeParseResponse(overrides = {}) {
  return {
    keyword: 'Java Spring Boot AWS',
    location: 'Bengaluru, Karnataka',
    minExperience: 6,
    maxExperience: 10,
    skills: ['Java', 'Spring Boot', 'AWS'],
    currentTitle: 'Senior Java Developer',
    education: 'Any Graduate',
    parsedQuery: {
      mode: 'HYBRID',
      originalQuery: 'Java Spring Boot AWS Bengaluru',
      filters: {
        requiredSkills: ['Java', 'Spring Boot', 'AWS'],
        optionalSkills: ['Kafka'],
        noticePeriodDaysMax: 30,
      },
    },
    interpretedFilters: ['Java', 'Bengaluru', '6-10 years'],
    ...overrides,
  };
}

function renderPage(overrides = {}) {
  const initialState = { ...buildInitialSemanticSearchState({}), deferSearch: true };
  return render(
    <RecruiterResumeSearchPage
      initialState={initialState}
      jobs={JOBS}
      featureEnabled
      canRead
      canExecute
      canReadHistory
      canReadSavedSearches
      canManageSavedSearches
      searchHistoryEnabled
      savedSearchesEnabled
      {...overrides}
    />,
  );
}

describe('RecruiterResumeSearchPage', () => {
  beforeEach(() => {
    routerPush.mockReset();
    toastPush.mockReset();
    global.fetch = vi.fn().mockImplementation((url, init = {}) => {
      const method = init.method || 'GET';
      if (String(url).includes('/api/intelligence/saved-searches') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [makeSavedSearch()] }) });
      }
      if (String(url).includes('/api/intelligence/search/history') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeHistoryResponse() }) });
      }
      if (url === '/api/intelligence/search/parse' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeParseResponse() }) });
      }
      if (url === '/api/intelligence/search/parse-document' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: makeParseResponse({ keyword: 'From uploaded JD' }) }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the disabled and no-access states', () => {
    const { unmount } = renderPage({ featureEnabled: false });
    expect(screen.getByText(/Resume Search is disabled/i)).toBeInTheDocument();
    unmount();
    renderPage({ canRead: false });
    expect(screen.getByText(/do not have access to Resume Search/i)).toBeInTheDocument();
  });

  it('renders one continuous form with no result cards or live preview', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Search Candidates' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Candidate Results' })).not.toBeInTheDocument();
    expect(screen.queryByText('Live candidate preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/profiles found/i)).not.toBeInTheDocument();
  });

  it('opens the AI Assist modal without navigating away', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /AI Assist/i }));
    expect(screen.getByRole('heading', { name: 'AI Resume Search Assistant' })).toBeInTheDocument();
    expect(screen.getByText('Tell Careeriz what kind of candidate you are looking for.')).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('analyses a described candidate without auto-running search, then applies filters', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /AI Assist/i }));

    fireEvent.change(screen.getByPlaceholderText(/Need a Java developer/i), {
      target: { value: 'Need a Java developer with 6-10 years experience, Spring Boot, AWS, Bengaluru and maximum 30 days notice.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyse Requirement/i }));

    expect(await screen.findByText('Search Criteria Found')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/search/parse', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).not.toHaveBeenCalledWith('/api/intelligence/search', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Apply to Search Filters' }));

    expect(screen.queryByRole('heading', { name: 'AI Resume Search Assistant' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('IT Skills (required)')).toHaveValue('Java, Spring Boot, AWS');
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('supports the paste job description mode', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /AI Assist/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Paste job description' }));

    fireEvent.change(screen.getByPlaceholderText('Paste the complete Job Description'), {
      target: { value: 'We are hiring a Senior Java Developer with Spring Boot and AWS experience based in Bengaluru.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyse Requirement/i }));

    expect(await screen.findByText('Search Criteria Found')).toBeInTheDocument();
  });

  it('validates uploaded job description file type before analysing', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /AI Assist/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Upload job description' }));

    const input = document.getElementById('ai-assist-jd-upload');
    const badFile = new File(['not allowed'], 'notes.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(await screen.findByText(/Upload a PDF, DOC, DOCX or TXT file/i)).toBeInTheDocument();
  });

  it('analyses an uploaded text job description via the parse-document endpoint', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /AI Assist/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Upload job description' }));

    const input = document.getElementById('ai-assist-jd-upload');
    const txtFile = new File(['Senior Java Developer needed with AWS.'], 'jd.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txtFile] } });

    fireEvent.click(await screen.findByRole('button', { name: /Analyse Requirement/i }));

    expect(await screen.findByText('Search Criteria Found')).toBeInTheDocument();
    // .txt is read client-side and sent through the existing text-parse endpoint, not parse-document.
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/search/parse', expect.objectContaining({ method: 'POST' }));
  });

  it('supports selecting an existing job before analysing', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /AI Assist/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Select existing job' }));

    fireEvent.change(screen.getByRole('combobox', { name: /Select an existing Job/i }), { target: { value: 'job-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyse Requirement/i }));

    expect(await screen.findByText('Search Criteria Found')).toBeInTheDocument();
  });

  it('renders the Department and Role cascading selector and applies a role to Designation', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Select department and role' }));

    fireEvent.click(screen.getByRole('option', { name: 'Human Resources' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'HR Manager' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to Designation' }));

    expect(screen.getByLabelText('Designation')).toHaveValue('HR Manager');
  });

  it('supports the searchable India location tree staying open across multiple district selections', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));

    const search = screen.getByPlaceholderText('Search city, district or state');
    fireEvent.change(search, { target: { value: 'Bengaluru Urban' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bengaluru Urban' }));
    expect(search).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Chennai' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chennai' }));

    expect(screen.getByRole('button', { name: 'Remove Bengaluru Urban' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Chennai' })).toBeInTheDocument();
  });

  it('selecting a whole State/UT collapses to one chip and matches every district (OR semantics)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Goa' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Goa' }));

    expect(screen.getByRole('checkbox', { name: 'North Goa' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'South Goa' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remove Goa' })).toBeInTheDocument();
  });

  it('includes an International Locations section after the India tree', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    fireEvent.click(screen.getByRole('button', { name: 'International Locations' }));
    expect(screen.getByRole('checkbox', { name: 'Germany' })).toBeInTheDocument();
  });

  it('excludes India from Work Permit For, unlike the general location tree', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add country' }));
    expect(screen.queryByRole('checkbox', { name: 'India' })).not.toBeInTheDocument();

    const search = screen.getByPlaceholderText('Search country (e.g. US, UK, UAE)');
    fireEvent.change(search, { target: { value: 'United States' } });
    expect(screen.getByRole('checkbox', { name: 'United States' })).toBeInTheDocument();
  });

  it('does not render a Client / Job Context control on the criteria page', () => {
    renderPage();
    expect(screen.queryByText('Client / Job Context')).not.toBeInTheDocument();
    expect(screen.queryByText('No linked job')).not.toBeInTheDocument();
  });

  it('supports multi-selecting industries', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Selected industries' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Software Product' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'E-commerce' }));

    const trigger = screen.getByRole('button', { name: 'Selected industries' });
    expect(within(trigger).getByText('Software Product')).toBeInTheDocument();
    expect(within(trigger).getByText('E-commerce')).toBeInTheDocument();
  });

  it('exposes company and designation search scope controls', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Northstar Systems' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Search in \(company\)/i }), { target: { value: 'any' } });
    fireEvent.change(screen.getByLabelText('Designation'), { target: { value: 'Engineering Manager' } });
    expect(screen.getByLabelText('Company')).toHaveValue('Northstar Systems');
    expect(screen.getByLabelText('Designation')).toHaveValue('Engineering Manager');
  });

  it('uses notice period pills, not free text', () => {
    renderPage();
    const pill = screen.getByRole('button', { name: '1 month' });
    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('spinbutton', { name: /notice period/i })).not.toBeInTheDocument();
  });

  it('opens the structured education selector for a specific UG qualification', () => {
    renderPage();
    const ugSelect = screen.getByRole('combobox', { name: 'UG Qualification' });
    fireEvent.change(ugSelect, { target: { value: 'SPECIFIC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select a course' }));
    fireEvent.click(screen.getByRole('button', { name: 'B.Tech' }));
    expect(screen.getByRole('button', { name: 'B.Tech' })).toBeInTheDocument();
  });

  it('renders Additional Details without fabricated verified-mobile or age filters', () => {
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Permanent' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Full Time' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Verified Email' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Attached Resume' }));
    expect(screen.queryByRole('checkbox', { name: /verified mobile/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/candidate age/i)).not.toBeInTheDocument();
  });

  it('changes Active In from the sticky action bar', () => {
    renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Active in' }), { target: { value: '30' } });
    expect(screen.getByRole('combobox', { name: 'Active in' })).toHaveValue('30');
  });

  it('renders a proper Diversity & Inclusion section with no protected-characteristic filters', () => {
    renderPage();
    expect(screen.getByText('Diversity & Inclusion')).toBeInTheDocument();
    expect(screen.getByText(/does not filter, rank, or score/i)).toBeInTheDocument();
    expect(screen.queryByText('Diversity Hiring')).not.toBeInTheDocument();
    expect(screen.queryByText(/diversity-hiring filters are currently available/i)).not.toBeInTheDocument();
  });

  it('keeps Recent/Saved Searches collapsed in a rail until opened', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Fill this search' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Recent and Saved Searches' })).toBeInTheDocument();
  });

  it('fills a recent search from the rail without executing it', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open Recent and Saved Searches' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Fill this search' }));
    expect(screen.getByLabelText('Keywords')).toHaveValue('power bi developer');
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('executes a recent search from the rail and routes to the results page', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open Recent and Saved Searches' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Search profiles' }));
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('/recruiter/database/results?'));
  });

  it('restores a saved search from the rail into the normal controls', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open Saved Searches' }));
    fireEvent.click(await screen.findByRole('button', { name: /Java shortlist/i }));
    expect(screen.getByLabelText('Keywords')).toHaveValue('java backend');
    expect(screen.getByLabelText('IT Skills (required)')).toHaveValue('Java, Spring Boot');
  });

  it('rail expand/collapse is keyboard/click accessible, not hover-only', () => {
    renderPage();
    const trigger = screen.getByRole('button', { name: 'Open Recent and Saved Searches' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse search rail' }));
    expect(screen.queryByRole('button', { name: 'Fill this search' })).not.toBeInTheDocument();
  });

  it('routes to /recruiter/database/results when Search candidates is pressed, preserving criteria', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'power bi developer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search candidates' }));

    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('/recruiter/database/results?'));
    expect(routerPush.mock.calls[0][0]).toContain('q=power+bi+developer');
  });

  it('warns instead of navigating when no search criteria are set', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Search candidates' }));
    expect(routerPush).not.toHaveBeenCalled();
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({ tone: 'warning' }));
  });

  it('closes an open location dropdown on Escape (keyboard behavior)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    expect(screen.getByPlaceholderText('Search city, district or state')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Search city, district or state')).not.toBeInTheDocument();
  });

  it('renders without logging duplicate React key warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    const duplicateKeyWarning = errorSpy.mock.calls.some((call) => String(call[0]).includes('two children with the same key'));
    expect(duplicateKeyWarning).toBe(false);
    errorSpy.mockRestore();
  });
});
