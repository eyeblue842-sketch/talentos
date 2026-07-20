import { redirect } from 'next/navigation';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';
import { AccessEntryCard } from '@/components/sections/access-entry-card';
import { candidateAuthRoutes } from '@/lib/auth-experience';
import { getCurrentUser } from '@/lib/auth';

export default async function CandidateEntryPage() {
  const user = await getCurrentUser();

  if (user?.role === 'CANDIDATE') {
    redirect('/candidate/dashboard');
  }

  if (user) {
    redirect('/');
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen max-w-[88rem] flex-col px-5 py-6 sm:px-6 lg:px-10">
        <AccessEntryCard
          eyebrow="Careeriz Jobs"
          title="Continue your career journey."
          description="Sign in to manage your profile and applications, or create a profile to get started."
          primaryLabel="Candidate Sign In"
          primaryHref={candidateAuthRoutes.login}
          secondaryLabel="Create Profile"
          secondaryHref={candidateAuthRoutes.register}
          bullets={[
            'Search relevant jobs',
            'Manage applications',
            'Improve your profile',
            'Prepare for interviews',
          ]}
        />
      </main>
      <PublicFooter />
    </>
  );
}
