import { redirect } from 'next/navigation';
import { AuthExperience } from '@/components/auth/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';
import { buildPathWithParams, employerAuthRoutes, isValidEmployerType } from '@/lib/auth-experience';
import { isSafeInternalPath } from '@/lib/roles';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function EmployerRegisterPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = await searchParams;

  if (!isValidEmployerType(params?.employerType)) {
    const safeParams = isSafeInternalPath(params?.next) ? { next: params.next } : {};
    redirect(buildPathWithParams(employerAuthRoutes.landing, safeParams));
  }

  return (
    <AuthExperience
      audience="employer"
      mode="register"
      initialSearchParams={params || {}}
    />
  );
}
