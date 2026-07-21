import { AuthExperience } from '@/components/auth/auth-experience';
import { getConfiguredSocialProviders } from '@/lib/auth-experience';
import { redirectIfAuthenticated } from '@/lib/auth';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function CandidateLoginPage({ searchParams }) {
  await redirectToSetupIfRequired();
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
