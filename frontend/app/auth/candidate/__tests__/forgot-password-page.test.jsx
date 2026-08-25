import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CandidateForgotPasswordPage from '@/app/auth/candidate/forgot-password/page';

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

describe('/auth/candidate/forgot-password', () => {
  test('renders the candidate-audience form', async () => {
    render(await CandidateForgotPasswordPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('forgot-password-form')).toHaveTextContent('candidate:undefined:undefined');
  });

  test('passes through a safe next path', async () => {
    render(await CandidateForgotPasswordPage({ searchParams: Promise.resolve({ next: '/candidate/jobs' }) }));
    expect(screen.getByTestId('forgot-password-form')).toHaveTextContent('candidate:undefined:/candidate/jobs');
  });

  test('drops an unsafe next path', async () => {
    render(await CandidateForgotPasswordPage({ searchParams: Promise.resolve({ next: 'https://evil.example.com' }) }));
    expect(screen.getByTestId('forgot-password-form')).toHaveTextContent('candidate:undefined:undefined');
  });
});
