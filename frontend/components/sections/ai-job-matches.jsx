import { BrainCircuit, BriefcaseBusiness, MapPin, Sparkles, Target, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function MatchMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InsightChip({ icon: Icon, label, value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-xs font-semibold text-white/82">
      <Icon size={14} />
      <span>{label}: {value}</span>
    </div>
  );
}

function FitBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#deebe0] bg-[#edf6ef] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6a7d70]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#102418]">{value}</p>
    </div>
  );
}

export function AiJobMatches({ jobs, preferenceProfile }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-[#173321] bg-[#0f2618] text-white shadow-[0_28px_80px_rgba(15,38,24,0.28)]">
      <div className="border-b border-white/10 px-5 py-5 md:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/72">
              <BrainCircuit size={14} />
              AI Job Matches
            </div>
            <h2 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2.2rem]">
              Recommended jobs based on candidate profile fit
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
              These roles are ranked separately from manual browse using skill overlap, preferred location fit, and expected CTC alignment.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <InsightChip icon={Target} label="Top skills" value={preferenceProfile.skills.slice(0, 4).join(', ')} />
              <InsightChip icon={MapPin} label="Preferred locations" value={preferenceProfile.preferredLocations.join(', ')} />
              <InsightChip icon={Wallet} label="Expected CTC" value={`INR ${preferenceProfile.expectedCtcLpa} LPA`} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px] xl:grid-cols-1">
            <MatchMetric label="Average Match" value="92% fit across top roles" />
            <MatchMetric label="Primary Signal" value="Skills and salary alignment" />
            <MatchMetric label="Discovery Mode" value="AI-ranked shortlist" />
          </div>
        </div>
      </div>

      <div className="px-5 py-5 md:px-7">
        <div className="mb-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/8 p-4 md:grid-cols-3">
          <div className="flex gap-3">
            <Sparkles className="mt-1 text-[var(--accent)]" size={16} />
            <div>
              <p className="text-sm font-semibold text-white">Skill Fit</p>
              <p className="mt-1 text-sm text-white/72">Ranks roles by overlap with the candidate&apos;s strongest technical and functional skills.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="mt-1 text-[var(--accent)]" size={16} />
            <div>
              <p className="text-sm font-semibold text-white">Location Fit</p>
              <p className="mt-1 text-sm text-white/72">Prioritizes preferred cities and remote-friendly roles before broader availability.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Wallet className="mt-1 text-[var(--accent)]" size={16} />
            <div>
              <p className="text-sm font-semibold text-white">CTC Fit</p>
              <p className="mt-1 text-sm text-white/72">Compares salary ranges against expected compensation to surface realistic opportunities first.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-[26px] border border-[#dbe9df] bg-[#f9fcfa] p-5 text-[#102418] shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a7d70]">AI recommendation</p>
                  <h3 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">{job.title}</h3>
                  <p className="mt-1 text-sm text-[#56705f]">{job.company} · {job.location}</p>
                </div>
                <Badge tone="success">{job.match}% match</Badge>
              </div>

              <p className="mt-4 text-sm leading-6 text-[#56705f]">{job.description}</p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <FitBox label="Skill Fit" value={job.metrics.skillFit} />
                <FitBox label="Location Fit" value={job.metrics.locationFit} />
                <FitBox label="CTC Fit" value={job.metrics.ctcFit} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-[#dbe9df] bg-white px-3 py-1 text-xs font-semibold text-[#166534]">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="mt-5 space-y-2 text-sm text-[#56705f]">
                {job.matchReasons.map((reason) => (
                  <div key={reason} className="flex gap-2">
                    <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#deebe0] bg-[#edf6ef] px-4 py-3 text-sm text-[#56705f]">
                <div className="flex items-center gap-2">
                  <Wallet size={15} />
                  <span>{job.salary}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness size={15} />
                  <span>{job.type}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
