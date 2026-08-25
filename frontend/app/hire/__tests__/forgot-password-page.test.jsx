import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EmployerForgotPasswordPage from '@/app/hire/forgot-password/page';

const redirectMock = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('next/navigation', () => ({
  redirect: (url) => redirectMock(url),
}));

vi.mock('@/lib/auth', () => ({
  redirectIfAuthenticated: vi.fn(async () => null),
}));

vi.mock('@/lib/setup', () => ({
  redirectToSetupIfRequired: vi.fn(async () => null),
}));

vi.mock('@/components/auth/forgot-password-form', () => ({
  ForgotPasswordForm: ({ audience, employerType, next }) => (
    <div data-testid="forgot-password-form">{`${audience}:${employerType}:${next}`}</div>
  ),
}));

describe('/hire/forgot-password employer type enforcement', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  test('missing employerType redirects to /hire instead of showing a generic form', async () => {
    await expect(
      EmployerForgotPasswordPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT:/hire');
  });

  test('an arbitrary/invalid employerType value is rejected, not trusted', async () => {
    await expect(
      EmployerForgotPasswordPage({ searchParams: Promise.resolve({ employerType: 'ADMIN' }) }),
    ).rejects.toThrow('REDIRECT:/hire');
  });

  test('an external/open-redirect next value is dropped rather than preserved', async () => {
    await expect(
      EmployerForgotPasswordPage({ searchParams: Promise.resolve({ next: 'https://evil.example.com/steal' }) }),
    ).rejects.toThrow('REDIRECT:/hire');
    expect(redirectMock).toHaveBeenCalledWith('/hire');
  });

  test('a valid employerType (case-insensitive) is accepted and renders the form', async () => {
    render(await EmployerForgotPasswordPage({ searchParams: Promise.resolve({ employerType: 'company', next: '/recruiter/jobs' }) }));

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('forgot-password-form')).toHaveTextContent('employer:COMPANY:/recruiter/jobs');
  });
});
