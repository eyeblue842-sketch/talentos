import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';
import { EmployerAccessCards } from '@/components/sections/employer-access-cards';
import { redirectIfAuthenticated } from '@/lib/auth';
import { redirectToSetupIfRequired } from '@/lib/setup';

// The "Employer Login" entry point across the app (marketing nav, /auth
// chooser) lands here. This is the CAREERIZ EMPLOYER ACCESS selection page:
// Consultancy Recruiter vs Company Recruiter. Both card actions carry the
// selection into /hire/login and /hire/register via ?employerType=.
export default async function HireEntryPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = await searchParams;

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen max-w-[88rem] flex-col px-5 py-6 sm:px-6 lg:px-10">
        <EmployerAccessCards searchParams={params || {}} />
      </main>
      <PublicFooter />
    </>
  );
}
