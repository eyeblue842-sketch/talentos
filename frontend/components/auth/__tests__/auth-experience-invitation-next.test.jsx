import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthExperience } from '@/components/auth/auth-experience';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const INVITATION_NEXT = '/auth/invitations/accept?token=abc123';

describe('AuthExperience employer registration / invitation "next" preservation', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { emailVerificationRequired: true } }),
    });
  });

  test('signup submits the invitation "next" so email verification can send the user back', async () => {
    render(
      <AuthExperience
        audience="employer"
        mode="register"
        initialSearchParams={{ next: INVITATION_NEXT, employerType: 'COMPANY' }}
      />
    );

    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'recruiter@company.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ngPass!23' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ngPass!23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create employer account' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.any(Object)));

    const [, requestInit] = global.fetch.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.next).toBe(INVITATION_NEXT);
    expect(body.email).toBe('recruiter@company.com');
  });

  test('signup omits "next" entirely when there is no invitation context', async () => {
    render(<AuthExperience audience="employer" mode="register" initialSearchParams={{ employerType: 'COMPANY' }} />);

    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'recruiter2@company.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ngPass!23' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ngPass!23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create employer account' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.any(Object)));

    const [, requestInit] = global.fetch.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.next).toBeUndefined();
  });
});
