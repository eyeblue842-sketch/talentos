import Link from 'next/link';
import { CheckCircle2, Clock3, IndianRupee, Mail, MapPin, PencilLine, Phone, BriefcaseBusiness } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CandidateAvatar } from '@/components/ui/candidate-avatar';
import { resolveCandidateProfilePhotoSrc } from '@/lib/candidate-profile-photo';
import { formatCandidateAnnualCtc } from '@/lib/ctc';
import { formatCareerizDate, formatCareerizUpdatedLabel } from '@/lib/date-format';

function formatNoticePeriod(value) {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return 'Not added';
  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? 'Month' : 'Months'} notice period`;
  }
  return `${days} days notice period`;
}

function formatExperience(value) {
  const years = Number(value);
  if (!Number.isFinite(years) || years <= 0) return 'Not added';
  return `${years} ${years === 1 ? 'Year' : 'Years'}`;
}

function InfoRow({ icon: Icon, label, value, verified = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-[var(--soft)] p-2 text-[var(--brand)]">
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">{value || 'Not added'}</p>
          {verified ? <CheckCircle2 size={16} className="text-emerald-600" aria-label={`${label} verified`} /> : null}
        </div>
      </div>
    </div>
  );
}

export function CandidateProfileSnapshot({ snapshot, onEdit }) {
  if (!snapshot) return null;
  const profilePhotoSrc = resolveCandidateProfilePhotoSrc(snapshot.profileImageUrl, snapshot.updatedAt);

  return (
    <section id="profile-snapshot" aria-label="Candidate profile summary" className="w-full scroll-mt-24">
      <Card className="w-full overflow-hidden rounded-[32px] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,250,255,0.98))] p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(var(--brand) 0 ${Math.max(0, Math.min(100, snapshot.completionPercentage || 0))}%, rgba(15,23,42,0.08) ${Math.max(0, Math.min(100, snapshot.completionPercentage || 0))}% 100%)`,
                }}
                aria-hidden="true"
              />
              <div className="absolute inset-[8px] rounded-full bg-white" aria-hidden="true" />
              <CandidateAvatar
                src={profilePhotoSrc}
                name={snapshot.fullName}
                alt={snapshot.fullName || 'Candidate profile image'}
                sizeClassName="h-24 w-24"
                className="relative"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm font-semibold text-[var(--brand)] shadow-sm">
                {snapshot.completionPercentage || 0}%
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-[var(--font-display)] text-3xl font-semibold text-[var(--color-text)]">
                  {snapshot.fullName || 'Not added'}
                </h1>
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="Edit profile snapshot"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--color-text-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  <PencilLine size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-lg font-medium text-[var(--color-text)]">{snapshot.currentTitle || 'Not added'}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                at {snapshot.currentEmployer || 'Not added'}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--color-text-muted)] lg:text-right">
            <p className="font-semibold text-[var(--color-text)]">Profile last updated</p>
            <p className="mt-1">{formatCareerizUpdatedLabel(snapshot.updatedAt)}</p>
          </div>
        </div>

        <div className="my-6 h-px bg-[var(--line)]" aria-hidden="true" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
          <div className="grid gap-5">
            <InfoRow icon={MapPin} label="Location" value={snapshot.location || 'Not added'} />
            <InfoRow icon={BriefcaseBusiness} label="Experience" value={formatExperience(snapshot.totalExperience)} />
            <InfoRow icon={IndianRupee} label="Current salary" value={formatCandidateAnnualCtc(snapshot.currentCtcLpa)} />
          </div>

          <div className="hidden bg-[var(--line)] lg:block" aria-hidden="true" />

          <div className="grid gap-5">
            <InfoRow icon={Phone} label="Phone number" value={snapshot.phoneNumber || 'Not added'} verified={Boolean(snapshot.phoneVerified)} />
            <InfoRow icon={Mail} label="Email" value={snapshot.email || 'Not added'} verified={Boolean(snapshot.emailVerified)} />
            <InfoRow icon={Clock3} label="Notice period" value={formatNoticePeriod(snapshot.noticePeriodDays)} />
          </div>
        </div>
      </Card>
    </section>
  );
}

export function CandidateResumeSummaryCard({ snapshot }) {
  if (!snapshot?.resumeStatus) return null;

  const resumeStatus = snapshot.resumeStatus;

  return (
    <section id="resume" className="scroll-mt-24">
    <Card className="rounded-[32px] p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Resume</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="truncate font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
              {resumeStatus.filename || 'No resume uploaded'}
            </h2>
            <div className="inline-flex w-fit rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
              {resumeStatus.parsingStatusLabel}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--color-text-muted)] md:flex-row md:flex-wrap md:items-center md:gap-x-6">
            <p>Uploaded on {formatCareerizDate(resumeStatus.uploadedAt)}</p>
            {resumeStatus.updatedAt ? <p>Updated {formatCareerizDate(resumeStatus.updatedAt)}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/candidate/resumes" className="rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white">Update Resume</Link>
          {resumeStatus.hasResume ? (
            <Link href="/candidate/resumes" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--color-text)]">Download Resume</Link>
          ) : null}
        </div>
      </div>
    </Card>
    </section>
  );
}
