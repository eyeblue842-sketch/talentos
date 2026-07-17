import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { JobApplicationFlow } from '../job-application-flow';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

function createFlowProps(overrides = {}) {
  return {
    candidate: {
      fullName: 'Aarav Sharma',
      email: 'aarav@example.com',
      currentTitle: 'Frontend Engineer',
    },
    resumes: [
      { id: 'resume-1', filename: 'resume.pdf', createdAt: '2026-07-10T00:00:00.000Z' },
      { id: 'resume-2', filename: 'resume-v2.pdf', createdAt: '2026-07-12T00:00:00.000Z' },
    ],
    job: {
      id: 'job-1',
      screeningQuestions: [
        {
          id: 'question-1',
          questionText: 'Years of React experience',
          internalLabel: 'React experience',
          questionType: 'NUMBER',
          required: true,
          displayOrder: 0,
          helpText: 'Count hands-on production years.',
          config: {},
        },
        {
          id: 'question-2',
          questionText: 'Preferred shift',
          internalLabel: 'Preferred shift',
          questionType: 'SINGLE_SELECT',
          required: false,
          displayOrder: 1,
          helpText: null,
          config: {
            options: [
              { value: 'DAY', label: 'Day' },
              { value: 'NIGHT', label: 'Night' },
            ],
          },
        },
      ],
    },
    ...overrides,
  };
}

async function goToConsentStep(user) {
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByLabelText(/Years of React experience/i), '4');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('JobApplicationFlow', () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    global.fetch = vi.fn();
  });

  test('preserves answers across steps, shows review content, and submits successfully', async () => {
    const user = userEvent.setup();
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'resume-3', filename: 'latest-resume.pdf' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { valid: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { publicReference: 'APP-4X92', submittedAt: '2026-07-17T09:15:00.000Z' } }) });

    render(<JobApplicationFlow {...createFlowProps()} />);

    await user.upload(screen.getByLabelText('Upload new resume'), new File(['resume'], 'latest-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('Resume uploaded successfully.');

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/Years of React experience/i), '6');
    await user.selectOptions(screen.getByLabelText(/Preferred shift/i), 'NIGHT');

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('React experience')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('NIGHT')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Night')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByLabelText(/I confirm that the information/i));
    await user.click(screen.getByLabelText(/I acknowledge the privacy notice/i));
    await user.click(screen.getByLabelText(/I agree to the relevant hiring terms/i));

    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByText('Application Submitted')).toBeInTheDocument();
    expect(screen.getByText('APP-4X92')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('shows resume and duplicate-application errors', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<JobApplicationFlow {...createFlowProps({ resumes: [] })} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Select or upload a resume to continue.')).toBeInTheDocument();
    unmount();

    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { valid: true } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'You have already applied to this job.' }) });

    render(<JobApplicationFlow {...createFlowProps()} />);
    await goToConsentStep(user);
    await user.click(screen.getByLabelText(/I confirm that the information/i));
    await user.click(screen.getByLabelText(/I acknowledge the privacy notice/i));
    await user.click(screen.getByLabelText(/I agree to the relevant hiring terms/i));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    await screen.findByText('You have already applied to this job.');
  });

  test('requires consent and surfaces closed-job validation failures', async () => {
    const user = userEvent.setup();
    render(<JobApplicationFlow {...createFlowProps()} />);

    await goToConsentStep(user);
    await user.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(screen.getByText('Consent is required.')).toBeInTheDocument();

    global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Applications are closed for this job.' }) });
    await user.click(screen.getByLabelText(/I confirm that the information/i));
    await user.click(screen.getByLabelText(/I acknowledge the privacy notice/i));
    await user.click(screen.getByLabelText(/I agree to the relevant hiring terms/i));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    await screen.findByText('Applications are closed for this job.');
  });

  test('screening step has no obvious accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<JobApplicationFlow {...createFlowProps()} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
