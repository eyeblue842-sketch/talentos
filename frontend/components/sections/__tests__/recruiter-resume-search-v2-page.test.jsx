import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterResumeSearchV2Page } from '../recruiter-resume-search-v2-page';
import { buildInitialResumeSearchV2State } from '@/lib/recruiter-resume-search-v2';

const routerPush = vi.fn();
const routerReplace = vi.fn();
const toastPush = vi.fn();
const router = { push: routerPush, replace: routerReplace };

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return { ...actual, useToast: () => ({ push: toastPush }) };
});

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function installMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => {
      const listeners = new Set();
      return {
        matches,
        media: '(max-width: 1279px)',
        onchange: null,
        addEventListener: (_event, listener) => listeners.add(listener),
        removeEventListener: (_event, listener) => listeners.delete(listener),
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener),
        dispatch: (nextMatches) => {
          listeners.forEach((listener) => listener({ matches: nextMatches }));
        },
      };
    }),
  });
}

function buildSuccessResponse(items, meta = {}) {
  // The real API returns { success, data: [...items], meta } - data and
  // meta are siblings, not nested (see requestResumeSearchV2's
  // parseResumeSearchV2Response call).
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: items,
      meta: {
        pageSize: 25,
        nextCursor: null,
        totalRelation: 'EQ',
        totalValue: items.length,
        searchEngine: 'OPENSEARCH',
        indexSchemaVersion: '2',
        queryFingerprint: 'fp-1',
        ...meta,
      },
    }),
  };
}

function renderPage(overrides = {}) {
  return render(
    <RecruiterResumeSearchV2Page
      initialState={buildInitialResumeSearchV2State({})}
      featureEnabled
      canRead
      canExecute
      canUseSalaryFilters={false}
      view="criteria"
      {...overrides}
    />,
  );
}

describe('RecruiterResumeSearchV2Page', () => {
  beforeEach(() => {
    routerPush.mockReset();
    routerReplace.mockReset();
    toastPush.mockReset();
    installMatchMedia(false);
    global.fetch = vi.fn();
  });

  it('renders disabled and no-access states', () => {
    const { unmount } = renderPage({ featureEnabled: false });
    expect(screen.getByText(/Resume Search V2 is disabled/i)).toBeInTheDocument();
    unmount();
    renderPage({ canRead: false });
    expect(screen.getByText(/do not have access to Resume Search V2/i)).toBeInTheDocument();
  });

  it('creates optional chips, toggles MUST, and excludes a phrase with keyboard-safe controls', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Type `IT`, `Sales`/i), {
      target: { value: 'IT, Sales, "Business HR Partner"' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Type `IT`, `Sales`/i), { key: 'Enter' });

    expect(screen.getByText('IT')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('"Business HR Partner"')).toBeInTheDocument();

    const firstStar = screen.getAllByRole('button', { name: 'Optional keyword' })[0];
    fireEvent.keyDown(firstStar, { key: 'Enter' });
    fireEvent.click(firstStar);
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Required keyword' })[0]).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[2]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Exclude keyword' }));
    expect((await screen.findAllByText('Excluded')).length).toBeGreaterThan(0);
  });

  it('builds a safe search url without persisting cursor state', () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Type `IT`, `Sales`/i), {
      target: { value: 'IT, Sales, SaaS' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Optional keyword' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Optional keyword' })[0]);
    fireEvent.change(screen.getByLabelText('Minimum experience (months)'), { target: { value: '60' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort results' }), { target: { value: 'EXPERIENCE_DESC' } });
    fireEvent.click(screen.getByRole('button', { name: /Search candidates/i }));

    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('/recruiter/database/results?'));
    const pushedUrl = routerPush.mock.calls[0][0];
    expect(pushedUrl).toContain('kw=MUST%3AIT');
    expect(pushedUrl).toContain('kw=MUST%3ASales');
    expect(pushedUrl).toContain('kw=SHOULD%3ASaaS');
    expect(pushedUrl).toContain('expMin=60');
    expect(pushedUrl).toContain('sort=EXPERIENCE_DESC');
    expect(pushedUrl).not.toContain('cursor=');
    expect(pushedUrl).not.toContain('pit');
  });

  it('opens mobile filters in a drawer, shows active filter count, and restores focus on close', async () => {
    installMatchMedia(true);
    renderPage();

    fireEvent.change(screen.getByLabelText('Minimum experience (months)'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Profile completeness min'), { target: { value: '70' } });

    const trigger = screen.getByRole('button', { name: 'Open filters, 2 active' });
    expect(trigger).toHaveTextContent('Filters (2)');
    trigger.focus();
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Search filters' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search filters' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('recovers safely from cursor expiry without writing cursor state back into the url', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ success: false, message: 'Cursor expired.' }),
    });

    renderPage({
      view: 'results',
      initialState: {
        ...buildInitialResumeSearchV2State({ kw: ['MUST:Java'] }),
        cursor: 'opaque-cursor',
      },
    });

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/recruiter/database/results?kw=MUST%3AJava'));
    expect(routerReplace.mock.calls[0][0]).not.toContain('cursor=');
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cursor expired' }));
  });

  it('aborts stale requests and prevents older responses from overwriting newer results', async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    let fetchCallCount = 0;

    global.fetch.mockImplementation((_url, options) => {
      fetchCallCount += 1;
      const deferred = fetchCallCount === 1 ? firstRequest : secondRequest;
      options.signal?.addEventListener('abort', () => {
        deferred.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      });
      return deferred.promise;
    });

    renderPage({
      view: 'results',
      initialState: buildInitialResumeSearchV2State({ kw: ['MUST:Java'] }),
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Minimum experience (months)'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /Search candidates/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(routerReplace).toHaveBeenCalledWith(expect.stringContaining('expMin=60'));

    await act(async () => {
      secondRequest.resolve(buildSuccessResponse([{
        documentId: 'doc-2',
        candidateId: 'candidate-2',
        normalizedName: 'Second Candidate',
        currentTitle: 'Sales Engineer',
        currentEmployer: 'Northstar Systems',
        currentLocation: 'Pune',
        totalExperienceMonths: 84,
        normalizedSkills: ['Java', 'AWS'],
        educationSummary: 'B.Tech',
        certifications: [],
        highlights: [{ field: 'normalizedSkills', snippets: ['Java and AWS'] }],
        explanations: [{ field: 'Skills', text: 'Required Java matched in Skills' }],
        resumeUpdatedAt: '2026-08-10T00:00:00.000Z',
        profileUpdatedAt: '2026-08-11T00:00:00.000Z',
        reviewRequired: false,
        parsingConfidence: 0.91,
        score: 77,
      }]));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getAllByText('Second Candidate').length).toBeGreaterThan(0));

    await act(async () => {
      firstRequest.resolve(buildSuccessResponse([{
        documentId: 'doc-1',
        candidateId: 'candidate-1',
        normalizedName: 'First Candidate',
        currentTitle: 'Legacy Result',
        currentEmployer: 'Old Employer',
        currentLocation: 'Delhi',
        totalExperienceMonths: 60,
        normalizedSkills: ['Java'],
        educationSummary: '',
        certifications: [],
        highlights: [{ field: 'normalizedSkills', snippets: ['Java'] }],
        explanations: [{ field: 'Skills', text: 'Required Java matched in Skills' }],
        resumeUpdatedAt: '2026-08-10T00:00:00.000Z',
        profileUpdatedAt: '2026-08-11T00:00:00.000Z',
        reviewRequired: false,
        parsingConfidence: 0.91,
        score: 41,
      }]));
      await Promise.resolve();
    });

    expect(screen.queryByText('First Candidate')).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it('opens a mobile candidate preview drawer with recruiter-safe details only', async () => {
    installMatchMedia(true);
    global.fetch.mockResolvedValueOnce(buildSuccessResponse([{
      documentId: 'doc-1',
      candidateId: 'candidate-1',
      normalizedName: 'Aarav Sharma',
      currentTitle: 'Senior Java Developer',
      currentEmployer: 'Northstar Systems',
      currentLocation: 'Bengaluru',
      totalExperienceMonths: 96,
      normalizedSkills: ['Java', 'Spring Boot', 'AWS'],
      educationSummary: 'B.Tech in Computer Science',
      certifications: ['AWS Certified Developer'],
      reviewRequired: false,
      parsingConfidence: 0.91,
      resumeUpdatedAt: '2026-08-10T00:00:00.000Z',
      profileUpdatedAt: '2026-08-11T00:00:00.000Z',
      highlights: [{ field: 'normalizedSkills', snippets: ['Java and Spring Boot'] }],
      explanations: [{ field: 'Skills', text: 'Required Java matched in Skills' }],
      score: 88,
    }]));

    renderPage({
      view: 'results',
      initialState: buildInitialResumeSearchV2State({ kw: ['MUST:Java'] }),
    });

    expect(await screen.findAllByText('Aarav Sharma')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByRole('dialog', { name: 'Aarav Sharma' })).toBeInTheDocument();
    expect(screen.getAllByText(/Why this candidate/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument();
  });

  it('renders safe results, highlights, and explanations without contact details or accessibility violations', async () => {
    global.fetch.mockResolvedValueOnce(buildSuccessResponse([{
      documentId: 'doc-1',
      candidateId: 'candidate-1',
      normalizedName: 'Aarav Sharma',
      currentTitle: 'Senior Java Developer',
      currentEmployer: 'Northstar Systems',
      currentLocation: 'Bengaluru',
      totalExperienceMonths: 96,
      normalizedSkills: ['Java', 'Spring Boot', 'AWS'],
      educationSummary: 'B.Tech in Computer Science',
      certifications: ['AWS Certified Developer'],
      reviewRequired: false,
      parsingConfidence: 0.91,
      resumeUpdatedAt: '2026-08-10T00:00:00.000Z',
      profileUpdatedAt: '2026-08-11T00:00:00.000Z',
      highlights: [
        { field: 'normalizedSkills', snippets: ['Java and Spring Boot'] },
        { field: 'currentTitle', snippets: ['Senior Java Developer'] },
      ],
      explanations: [{ field: 'Skills', text: 'Required Java matched in Skills' }],
      score: 88,
    }]));

    const { container } = renderPage({
      view: 'results',
      initialState: buildInitialResumeSearchV2State({ kw: ['MUST:Java'] }),
    });

    expect((await screen.findAllByText('Aarav Sharma')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Required Java matched in Skills/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
