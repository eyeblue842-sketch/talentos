import Link from 'next/link';
import { ArrowRight, BadgeIndianRupee, BriefcaseBusiness, FileUser, GraduationCap, MapPin, Sparkles, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';

const noticePeriods = ['Immediate', '15 days', '30 days', '60 days', '90 days'];
const employmentTypes = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'];
const qualificationLevels = ['10th', '12th', 'Diploma', 'Bachelor Degree', 'Master Degree', 'Doctorate', 'Professional Certification'];

export default function CandidateOnboardingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="bg-[#102418] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-white/56">Candidate Step 2</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold">
            Complete a detailed candidate profile after registration.
          </h1>
          <div className="mt-8 space-y-4 text-sm text-white/76">
            <div className="flex gap-3">
              <FileUser size={18} className="mt-1" />
              <span>Capture profile headline, summary, location, and contact details.</span>
            </div>
            <div className="flex gap-3">
              <BriefcaseBusiness size={18} className="mt-1" />
              <span>Add current employment, total experience, notice period, and preferred job types.</span>
            </div>
            <div className="flex gap-3">
              <GraduationCap size={18} className="mt-1" />
              <span>Include education, key skills, projects, certifications, and resume upload.</span>
            </div>
          </div>
          <div className="mt-10 rounded-[24px] border border-white/10 bg-white/6 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">Naukri-style profile sections</p>
            <div className="mt-4 grid gap-3 text-sm text-white/76">
              <div>Basic information and profile summary</div>
              <div>Employment details and salary expectations</div>
              <div>Education, projects, certifications, and skills</div>
              <div>Preferred locations and resume upload</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Candidate profile setup</p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Candidate details</h2>
            </div>
            <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Complete after candidate signup</span>
          </div>

          <div className="mt-6 grid gap-6">
            <section className="rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Upload className="text-[var(--brand)]" size={18} />
                  <div>
                    <p className="font-semibold">Upload resume first</p>
                    <p className="text-sm text-[var(--muted)]">PDF or DOCX for recruiter preview, ATS tracking, and profile auto-fill.</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Sparkles size={14} />
                  Auto-fill form
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
                  Choose resume file
                </button>
                <p className="text-sm text-[var(--muted)]">
                  After upload, extracted details can prefill name, experience, skills, education, and project sections.
                </p>
              </div>
            </section>

            <section className="rounded-[24px] border border-[var(--line)] bg-[#fffefb] p-4 text-sm text-[var(--muted)]">
              Review and edit the extracted details below before saving your candidate profile.
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Full name" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Mobile number" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Profile headline" />
              <textarea className="min-h-28 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Profile summary" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Current location" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Preferred locations (comma separated)" />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Total experience in years" />
              <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option>Notice period</option>
                {noticePeriods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Current company" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Current designation" />
              <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option>Preferred employment type</option>
                {employmentTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Key skills (comma separated)" />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <BadgeIndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input className="w-full rounded-2xl border border-[var(--line)] py-3 pl-10 pr-4" placeholder="Current CTC" />
              </div>
              <div className="relative">
                <BadgeIndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input className="w-full rounded-2xl border border-[var(--line)] py-3 pl-10 pr-4" placeholder="Expected CTC" />
              </div>
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Languages known" />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option>Highest qualification</option>
                {qualificationLevels.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Institute / University" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Course / Specialization" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Passing year" />
            </section>

            <section className="grid gap-4">
              <textarea className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Projects" />
              <textarea className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Certifications" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Portfolio / LinkedIn URL" />
            </section>

          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">
              Save candidate profile <ArrowRight size={16} />
            </button>
            <Link href="/candidate/dashboard" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">
              Go to candidate dashboard
            </Link>
          </div>

          <div className="mt-6 grid gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)] md:grid-cols-3">
            <div className="flex gap-2">
              <MapPin size={16} className="mt-1 text-[var(--brand)]" />
              <span>Preferred location capture</span>
            </div>
            <div className="flex gap-2">
              <BriefcaseBusiness size={16} className="mt-1 text-[var(--brand)]" />
              <span>Employment and notice period capture</span>
            </div>
            <div className="flex gap-2">
              <GraduationCap size={16} className="mt-1 text-[var(--brand)]" />
              <span>Education and certification capture</span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
