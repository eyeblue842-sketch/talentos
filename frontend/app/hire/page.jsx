import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';
import { AccessEntryCard } from '@/components/sections/access-entry-card';
import { redirectIfAuthenticated } from '@/lib/auth';
import { employerAuthRoutes } from '@/lib/auth-experience';

export default async function HireEntryPage() {
  await redirectIfAuthenticated();

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen max-w-[88rem] flex-col px-5 py-6 sm:px-6 lg:px-10">
        <AccessEntryCard
          eyebrow="Careeriz Hire"
          title="Access your hiring workspace."
          description="Sign in to manage your recruitment workflow, or create a workspace to start hiring."
          primaryLabel="Employer Sign In"
          primaryHref={employerAuthRoutes.login}
          secondaryLabel="Create Workspace"
          secondaryHref={employerAuthRoutes.register}
          bullets={[
            'Publish and manage jobs',
            'Track candidates',
            'Coordinate interviews',
            'Manage hiring decisions',
          ]}
          accentClassName="text-[var(--color-info)]"
          surfaceClassName="bg-[linear-gradient(180deg,#ffffff_0%,#eef5ff_100%)]"
        />
      </main>
      <PublicFooter />
    </>
  );
}
