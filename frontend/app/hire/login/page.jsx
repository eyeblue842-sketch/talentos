import { AuthExperience } from '@/components/auth/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function EmployerLoginPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = await searchParams;

  return (
    <AuthExperience
      audience="employer"
      mode="login"
      initialSearchParams={params || {}}
    />
  );
}
