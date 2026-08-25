import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ResetPasswordPage from '@/app/auth/reset-password/page';

const getResetSessionTokenMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  getResetSessionToken: () => getResetSessionTokenMock(),
}));

vi.mock('@/components/auth/reset-password-form', () => ({
  ResetPasswordForm: ({ linkInvalid }) => (
    <div data-testid="reset-password-form">{`linkInvalid:${linkInvalid}`}</div>
  ),
}));

describe('/auth/reset-password', () => {
  test('renders the form as valid when a reset-session cookie is present and no resetError param', async () => {
    getResetSessionTokenMock.mockResolvedValue('a-valid-session-token');
    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('reset-password-form')).toHaveTextContent('linkInvalid:false');
  });

  test('treats a missing reset-session cookie as an invalid link', async () => {
    getResetSessionTokenMock.mockResolvedValue(null);
    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('reset-password-form')).toHaveTextContent('linkInvalid:true');
  });

  test('treats an explicit resetError query param as an invalid link even if a cookie exists', async () => {
    getResetSessionTokenMock.mockResolvedValue('a-valid-session-token');
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ resetError: '1' }) }));
    expect(screen.getByTestId('reset-password-form')).toHaveTextContent('linkInvalid:true');
  });
});
