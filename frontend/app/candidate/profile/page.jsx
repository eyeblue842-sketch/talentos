import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandidateProfileForm } from '@/components/sections/candidate-profile-form';
import { candidateNav } from '@/lib/navigation';
import { getCandidateProfile } from '@/lib/api';

export default async function CandidateProfilePage() {
  const { profile, completion } = await getCandidateProfile();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Candidate profile</p>
            <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Keep your profile current</h1>
          </div>
          <Badge tone="brand">{completion.percentage}% complete</Badge>
        </div>
        <Card className="rounded-[32px] p-6">
          <CandidateProfileForm profile={profile} />
        </Card>
      </section>
    </main>
  );
}
