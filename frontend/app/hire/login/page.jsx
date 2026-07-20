import { AuthExperience } from '@/components/auth/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';

export default async function EmployerLoginPage({ searchParams }) {
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
