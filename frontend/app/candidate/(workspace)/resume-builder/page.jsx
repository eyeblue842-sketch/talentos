import { Sidebar } from '@/components/layout/sidebar';
import { ResumeBuilderStudio } from '@/components/sections/resume-builder-studio';
import { candidateNav } from '@/lib/navigation';

export default function CandidateResumeBuilderPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <ResumeBuilderStudio compact />
    </main>
  );
}

