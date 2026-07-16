import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { recruiterNav } from '@/lib/mock-data';
import { getCurrentOrganisation } from '@/lib/api';

export default async function RecruiterSettingsPage() {
  let organisation = null;
  let error = '';

  try {
    organisation = await getCurrentOrganisation();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card>
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Organisation settings</h1>
          {error ? <p className="mt-3 text-sm text-[var(--muted)]">{error}</p> : null}
          {!error && !organisation ? <p className="mt-3 text-sm text-[var(--muted)]">Loading organisation context.</p> : null}
          {organisation ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <p className="font-semibold">Name</p>
                <p className="text-[var(--muted)]">{organisation.name}</p>
              </div>
              <div>
                <p className="font-semibold">Slug</p>
                <p className="text-[var(--muted)]">{organisation.slug}</p>
              </div>
              <div>
                <p className="font-semibold">Status</p>
                <p className="text-[var(--muted)]">{organisation.status}</p>
              </div>
              <div>
                <p className="font-semibold">Website</p>
                <p className="text-[var(--muted)]">{organisation.website || 'Not configured'}</p>
              </div>
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
