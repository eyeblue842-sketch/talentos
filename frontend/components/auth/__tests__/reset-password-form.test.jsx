import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

function mockAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  return assign;
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test('an invalid/expired link shows an error state instead of any form', () => {
    render(<ResetPasswordForm linkInvalid />);
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
  });

  test('the password fields are not shown until the OTP is verified', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { verified: true } }) });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/6-digit code/i), '482913');
    await user.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/password-reset/otp/verify',
      expect.objectContaining({ body: JSON.stringify({ code: '482913' }) })
    );
  });

  test('an incorrect code shows an error and keeps the user on the OTP step', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Incorrect verification code.' }),
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect verification code/i)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
  });

  test('resend requests a new code without requiring a code to already be entered', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { resent: true } }) });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.click(screen.getByRole('button', { name: /resend code/i }));

    await waitFor(() => {
      expect(screen.getByText(/new verification code has been sent/i)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/password-reset/otp/resend', expect.objectContaining({ method: 'POST' }));
  });

  test('after verifying, submitting matching passwords redirects to the candidate login on success', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { verified: true } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { reset: true, audience: 'candidate' } }),
      });
    const assign = mockAssign();
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/6-digit code/i), '482913');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/^new password$/i), 'BrandNewPassword123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'BrandNewPassword123');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password reset complete/i)).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(1300);
    expect(assign).toHaveBeenCalledWith('/auth/candidate/login?resetSuccess=1');
  });

  test('after verifying, a successful employer reset redirects to the hire login with the correct employerType', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { verified: true } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { reset: true, audience: 'employer', employerType: 'COMPANY' } }),
      });
    const assign = mockAssign();
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/6-digit code/i), '482913');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/^new password$/i), 'BrandNewPassword123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'BrandNewPassword123');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password reset complete/i)).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(1300);
    expect(assign).toHaveBeenCalledWith('/hire/login?employerType=COMPANY&resetSuccess=1');
  });

  test('mismatched passwords disable submission with an inline error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { verified: true } }) });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/6-digit code/i), '482913');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/^new password$/i), 'BrandNewPassword123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'SomethingDifferent123');

    expect(screen.getByText(/passwords must match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set new password/i })).toBeDisabled();
  });

  test('has no detectable accessibility violations on the OTP step', async () => {
    const { container } = render(<ResetPasswordForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no detectable accessibility violations on the invalid-link state', async () => {
    const { container } = render(<ResetPasswordForm linkInvalid />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
