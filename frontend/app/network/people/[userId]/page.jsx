import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, GraduationCap } from 'lucide-react';
import { NetworkProfileActions } from '@/components/network/network-profile-actions';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { CandidateAvatar } from '@/components/ui/candidate-avatar';
import { getCurrentUser } from '@/lib/auth';
import { getProfessionalProfile } from '@/lib/api';
import { formatLocationLabel } from '@/lib/location-format';
import { candidateNav, recruiterNav } from '@/lib/navigation';

const SKILLS_PREVIEW = 12;

function periodLabel(item) {
  const from = item.startDate || '';
  const to = item.currentlyWorking ? 'Present' : (item.endDate || '');
  const range = [from, to].filter(Boolean).join(' - ');
  return [range, item.tenure].filter(Boolean).join(' · ');
}

function Section({ title, children }) {
  return (
    <Card className="rounded-[24px] p-6">
      <h2 className="font-[var(--font-display)] text-2xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

// What a person looks like to someone who wants to connect (LinkedIn style). Recruiters and
// candidates see exactly the same thing: no resume, salary or preferences here - recruiters get
// those through resume search. Contact details only appear when the candidate's profile is Public.
export default async function ProfessionalProfilePage({ params }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth');
  }

  if (!['CANDIDATE', 'CANDIDATE_ADMIN', 'RECRUITER', 'RECRUITER_ADMIN'].includes(user.role)) {
    redirect(user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN' ? '/admin' : '/auth');
  }

  const { userId } = await params;

  let data;
  try {
    data = await getProfessionalProfile(userId);
  } catch (error) {
    if (error.statusCode === 404) notFound();
    throw error;
  }

  const isRecruiterViewer = user.role.startsWith('RECRUITER');
  const nav = isRecruiterViewer ? recruiterNav : candidateNav;
  const brand = isRecruiterViewer ? 'Careeriz Hire' : 'Careeriz';
  const profile = data.profile;
  const detail = data.detail || {};
  const redirectTo = `/network/people/${profile.userId}`;
  const isRecruiterProfile = profile.role.startsWith('RECRUITER');
  const experience = detail.experience || [];
  const education = detail.education || [];
  const skills = detail.skills || [];
  const headline = profile.designation || profile.headline || 'Careeriz professional';
  const topEducation = education[0] || null;
  const mutualCount = profile.mutualConnections?.count || 0;

  return (
    <WorkspaceShell brand={brand} items={nav}>
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <Card className="overflow-hidden rounded-[24px] p-0">
          <div className="h-28 bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-bg-muted))] sm:h-36" aria-hidden="true" />
          <div className="px-6 pb-6">
            <div className="-mt-14 flex items-end justify-between gap-4 sm:-mt-16">
              <CandidateAvatar
                src={detail.hasPhoto ? `/api/network/people/${profile.userId}/photo` : null}
                name={profile.fullName}
                alt={`${profile.fullName} profile photo`}
                sizeClassName="h-28 w-28 sm:h-32 sm:w-32"
                className="rounded-full border-4 border-white bg-white shadow"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-[var(--font-display)] text-3xl font-semibold">{profile.fullName}</h1>
                  {detail.degree ? <span className="text-sm text-[var(--color-text-muted)]">· {detail.degree}</span> : null}
                </div>
                <p className="mt-1 text-lg text-[var(--color-text)]">{headline}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {profile.location ? formatLocationLabel(profile.location) : null}
                  {detail.contact ? (
                    <>
                      {profile.location ? ' · ' : null}
                      <a href="#contact-info" className="font-semibold text-[var(--color-primary)]">Contact info</a>
                    </>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {detail.connectionsCount ?? 0} {detail.connectionsCount === 1 ? 'connection' : 'connections'}
                  {mutualCount ? ` · ${mutualCount} mutual` : ''}
                </p>
              </div>

              <div className="grid gap-2 text-sm font-semibold text-[var(--color-text)]">
                {profile.company ? (
                  <p className="flex items-center gap-2"><Building2 size={18} aria-hidden="true" className="text-[var(--color-text-muted)]" />{profile.company}</p>
                ) : null}
                {topEducation?.institution ? (
                  <p className="flex items-center gap-2"><GraduationCap size={18} aria-hidden="true" className="text-[var(--color-text-muted)]" />{topEducation.institution}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5">
              <NetworkProfileActions
                profile={profile}
                redirectTo={redirectTo}
                source="PROFILE"
                allowViewProfile={false}
                layout="row"
                messageHref={`${isRecruiterViewer ? '/recruiter/messages' : '/candidate/messages'}?user=${profile.userId}`}
              />
            </div>

            {detail.contact && (detail.contact.email || detail.contact.phone) ? (
              <div id="contact-info" className="mt-5 rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold text-[var(--color-text)]">Contact info</p>
                <dl className="mt-2 grid gap-1 text-[var(--color-text-secondary)]">
                  {detail.contact.email ? <div className="flex gap-2"><dt className="w-14 text-[var(--color-text-muted)]">Email</dt><dd><a className="text-[var(--color-primary)]" href={`mailto:${detail.contact.email}`}>{detail.contact.email}</a></dd></div> : null}
                  {detail.contact.phone ? <div className="flex gap-2"><dt className="w-14 text-[var(--color-text-muted)]">Phone</dt><dd>{detail.contact.phone}</dd></div> : null}
                </dl>
              </div>
            ) : null}
          </div>
        </Card>

        {detail.about ? (
          <Section title="About">
            <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-secondary)]">{detail.about}</p>
          </Section>
        ) : null}

        {experience.length ? (
          <Section title="Experience">
            <ul className="grid gap-5">
              {experience.map((item, index) => (
                <li key={`${item.company}-${item.title}-${index}`} className="flex gap-4">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]" aria-hidden="true">
                    <Building2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">{item.title || item.company}</p>
                    {item.title && item.company ? (
                      <p className="text-sm text-[var(--color-text)]">{item.company}{item.employmentType ? ` · ${item.employmentType}` : ''}</p>
                    ) : null}
                    {periodLabel(item) ? <p className="text-sm text-[var(--color-text-muted)]">{periodLabel(item)}</p> : null}
                    {item.location ? <p className="text-sm text-[var(--color-text-muted)]">{formatLocationLabel(item.location)}</p> : null}
                    {item.summary ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.summary}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {education.length ? (
          <Section title="Education">
            <ul className="grid gap-4">
              {education.map((item, index) => (
                <li key={`${item.institution}-${index}`} className="flex gap-4">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]" aria-hidden="true">
                    <GraduationCap size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">{item.institution || item.degree}</p>
                    {item.institution && (item.degree || item.fieldOfStudy) ? (
                      <p className="text-sm text-[var(--color-text-secondary)]">{[item.degree, item.fieldOfStudy].filter(Boolean).join(', ')}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {skills.length ? (
          <Section title={`Skills (${skills.length})`}>
            <ul className="flex flex-wrap gap-2">
              {skills.slice(0, SKILLS_PREVIEW).map((skill) => (
                <li key={skill} className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">{skill}</li>
              ))}
            </ul>
            {skills.length > SKILLS_PREVIEW ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-muted)]">Show all</summary>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {skills.slice(SKILLS_PREVIEW).map((skill) => (
                    <li key={skill} className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">{skill}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Section>
        ) : null}

        {!detail.about && !experience.length && !education.length && !skills.length && !isRecruiterProfile ? (
          <Card className="rounded-[24px] p-6 text-sm text-[var(--color-text-muted)]">This person has not added more to their profile yet.</Card>
        ) : null}

        <div>
          <Link href={isRecruiterViewer ? '/recruiter/network' : '/candidate/network'} className="inline-flex text-sm font-semibold text-[var(--color-primary)]">
            Back to network
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  );
}
