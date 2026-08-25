import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getResetSessionToken } from '@/lib/auth';

// Deliberately does not call redirectIfAuthenticated(): a user resetting
// their password may still be signed in elsewhere (e.g. an old device), and
// that pre-existing session must not block them from completing the reset.
export default async function ResetPasswordPage({ searchParams }) {
  const params = (await searchParams) || {};
  const sessionToken = await getResetSessionToken();
  const linkInvalid = Boolean(params.resetError) || !sessionToken;

  return <ResetPasswordForm linkInvalid={linkInvalid} />;
}
