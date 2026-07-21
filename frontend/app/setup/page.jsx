import { redirectAwayFromSetupIfInitialized } from '@/lib/setup';
import { SetupWizard } from '@/components/setup/setup-wizard';
import { Badge } from '@/components/ui/badge';

export default async function SetupPage() {
  await redirectAwayFromSetupIfInitialized();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 lg:px-10">
      <div className="max-w-3xl">
        <Badge variant="purple" className="px-4 py-1.5 text-[11px] uppercase tracking-[0.24em]">Initial Setup Wizard</Badge>
        <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)]">
          Complete the first-time Careeriz installation.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--color-text-secondary)]">
          This setup runs only once. It creates the first organization, the first super administrator account, and the initial platform defaults required for login and ongoing administration.
        </p>
      </div>

      <section className="mt-8">
        <SetupWizard />
      </section>
    </main>
  );
}
