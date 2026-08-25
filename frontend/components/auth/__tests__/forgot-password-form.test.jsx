import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('submitting shows the same non-enumerating confirmation regardless of whether the account exists', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { requested: true } }),
    });

    const user = userEvent.setup();
    render(<ForgotPasswordForm audience="candidate" />);

    await user.type(screen.getByLabelText(/email/i), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/if an account exists for that email/i)).toBeInTheDocument();
    });

    // The form itself is replaced by the confirmation - there is nothing left
    // to resubmit, and no signal distinguishing "existed" from "did not".
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();
  });

  test('sends audience, employerType, and next context to the backend', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { requested: true } }),
    });

    const user = userEvent.setup();
    render(<ForgotPasswordForm audience="employer" employerType="COMPANY" next="/recruiter/jobs" />);

    await user.type(screen.getByLabelText(/work email/i), 'recruiter@company.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      email: 'recruiter@company.com',
      audience: 'employer',
      employerType: 'COMPANY',
      next: '/recruiter/jobs',
    });
  });

  test('shows an error message when the request itself fails (e.g. rate limited), without implying the email is invalid', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Too many requests. Please try again later.' }),
    });

    const user = userEvent.setup();
    render(<ForgotPasswordForm audience="candidate" />);

    await user.type(screen.getByLabelText(/email/i), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    });
  });

  test('links back to the correct portal-specific sign-in page', () => {
    render(<ForgotPasswordForm audience="employer" employerType="CONSULTANCY" />);
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/hire/login');
  });

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<ForgotPasswordForm audience="candidate" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
