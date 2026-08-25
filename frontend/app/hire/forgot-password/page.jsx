import { redirect } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { redirectIfAuthenticated } from '@/lib/auth';
import { buildPathWithParams, employerAuthRoutes, isValidEmployerType, normalizeEmployerType } from '@/lib/auth-experience';
import { isSafeInternalPath } from '@/lib/roles';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function EmployerForgotPasswordPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = (await searchParams) || {};

  if (!isValidEmployerType(params.employerType)) {
    const safeParams = isSafeInternalPath(params.next) ? { next: params.next } : {};
    redirect(buildPathWithParams(employerAuthRoutes.landing, safeParams));
  }

  return (
    <ForgotPasswordForm
      audience="employer"
      employerType={normalizeEmployerType(params.employerType)}
      next={isSafeInternalPath(params.next) ? params.next : undefined}
    />
  );
}
