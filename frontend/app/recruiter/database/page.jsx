import { Download, Eye, Bookmark } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav, resumeDatabase } from '@/lib/mock-data';

export default function RecruiterDatabasePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Resume database</h1>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Skill keyword" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Experience" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Location" />
            <select className="rounded-2xl border border-[var(--line)] px-4 py-3"><option>Availability</option><option>Immediate</option><option>2 weeks</option></select>
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {resumeDatabase.map((candidate) => (
            <Card key={candidate.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[var(--font-display)] text-xl font-semibold">{candidate.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{candidate.title} • {candidate.location}</p>
                </div>
                <Badge tone="brand">{candidate.experience}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.skills.map((skill) => <span key={skill} className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">{skill}</span>)}
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">Availability: {candidate.availability}</p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
                <button className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2"><Eye size={16} /> Preview</button>
                <button className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2"><Download size={16} /> Download</button>
                <button className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-2 text-white"><Bookmark size={16} /> Save</button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

