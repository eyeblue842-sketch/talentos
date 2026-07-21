import { AuthExperience } from '@/components/auth/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function EmployerRegisterPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = await searchParams;

  return (
    <AuthExperience
      audience="employer"
      mode="register"
      initialSearchParams={params || {}}
    />
  );
}
