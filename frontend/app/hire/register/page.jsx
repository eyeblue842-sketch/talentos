import { AuthExperience } from '@/components/auth/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';

export default async function EmployerRegisterPage({ searchParams }) {
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
