import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EmployerLoginPage from '@/app/hire/login/page';
import EmployerRegisterPage from '@/app/hire/register/page';

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

vi.mock('@/components/auth/auth-experience', () => ({
  AuthExperience: ({ audience, mode, initialSearchParams }) => (
    <div data-testid="auth-experience">{`${audience}:${mode}:${JSON.stringify(initialSearchParams)}`}</div>
  ),
}));

describe.each([
  ['/hire/login', EmployerLoginPage, 'login'],
  ['/hire/register', EmployerRegisterPage, 'register'],
])('%s employer type enforcement', (_path, PageComponent, mode) => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  test('missing employerType redirects to /hire instead of showing a generic employer form', async () => {
    await expect(
      PageComponent({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT:/hire');
  });

  test('an arbitrary/invalid employerType value is rejected, not trusted', async () => {
    await expect(
      PageComponent({ searchParams: Promise.resolve({ employerType: 'ADMIN' }) }),
    ).rejects.toThrow('REDIRECT:/hire');
  });

  test('a safe same-origin next survives the redirect back to /hire', async () => {
    await expect(
      PageComponent({ searchParams: Promise.resolve({ next: '/recruiter/jobs' }) }),
    ).rejects.toThrow('REDIRECT:/hire?next=%2Frecruiter%2Fjobs');
  });

  test('an external/open-redirect next value is dropped rather than preserved', async () => {
    await expect(
      PageComponent({ searchParams: Promise.resolve({ next: 'https://evil.example.com/steal' }) }),
    ).rejects.toThrow('REDIRECT:/hire');
    expect(redirectMock).toHaveBeenCalledWith('/hire');
  });

  test('a protocol-relative next value is dropped rather than preserved', async () => {
    await expect(
      PageComponent({ searchParams: Promise.resolve({ next: '//evil.example.com/steal' }) }),
    ).rejects.toThrow('REDIRECT:/hire');
    expect(redirectMock).toHaveBeenCalledWith('/hire');
  });

  test('a valid employerType (case-insensitive) is accepted and renders the form instead of redirecting', async () => {
    render(await PageComponent({ searchParams: Promise.resolve({ employerType: 'company' }) }));

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-experience')).toHaveTextContent(`employer:${mode}`);
    expect(screen.getByTestId('auth-experience')).toHaveTextContent('"employerType":"company"');
  });
});
