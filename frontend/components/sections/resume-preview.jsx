import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ResumePreview({ profile, template = 'classic' }) {
  return (
    <Card className="bg-[#fffefb]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Template</p>
          <h3 className="mt-1 font-[var(--font-display)] text-2xl font-semibold capitalize">{template}</h3>
        </div>
        <Badge tone="brand">ATS Friendly</Badge>
      </div>
      <div className="mt-6 rounded-[20px] border border-[var(--line)] bg-white p-5">
        <h4 className="font-[var(--font-display)] text-2xl font-semibold">{profile.fullName}</h4>
        <p className="mt-1 text-sm text-[var(--muted)]">{profile.title} | {profile.location}</p>
        <div className="mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Skills</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{profile.skills.join(', ')}</p>
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Projects</p>
          <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
            {profile.projects.map((project) => (
              <div key={project.name}>
                <p className="font-semibold text-[var(--text)]">{project.name}</p>
                <p>{project.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

