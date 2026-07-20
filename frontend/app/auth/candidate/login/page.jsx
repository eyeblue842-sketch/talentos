import { AuthExperience } from '@/components/auth/auth-experience';
import { getConfiguredSocialProviders } from '@/lib/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';

export default async function CandidateLoginPage({ searchParams }) {
  await redirectIfAuthenticated();
  const params = await searchParams;

  return (
    <AuthExperience
      audience="candidate"
      mode="login"
      providers={getConfiguredSocialProviders()}
      initialSearchParams={params || {}}
    />
  );
}
