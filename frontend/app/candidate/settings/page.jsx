import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { CandidateSettingsForm } from '@/components/sections/candidate-settings-form';
import { candidateNav } from '@/lib/navigation';
import { getCandidateSettings } from '@/lib/api';

export default async function CandidateSettingsPage() {
  const { settings } = await getCandidateSettings();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Candidate settings</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Control visibility, recommendations, and alerts</h1>
        </div>
        <Card className="rounded-[32px] p-6">
          <CandidateSettingsForm settings={settings} />
        </Card>
      </section>
    </main>
  );
}
