import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { safeInternalPath } from '@/lib/roles';
import { redirectIfAuthenticated } from '@/lib/auth';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function CandidateForgotPasswordPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = (await searchParams) || {};

  return (
    <ForgotPasswordForm
      audience="candidate"
      next={safeInternalPath(params.next, null) || undefined}
    />
  );
}
