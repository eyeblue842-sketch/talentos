import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { getCandidateResumeAssets, getPublicJobApplyContext } from '@/lib/api';
import { JobApplicationFlow } from '@/components/sections/job-application-flow';
import { getHomeRouteForRole } from '@/lib/roles';

export default async function JobApplyPage({ params }) {
  const { slug } = await params;
  const [user, applyContext] = await Promise.all([
    getCurrentUser(),
    getPublicJobApplyContext(slug),
  ]);

  if (!user) {
    redirect(`/auth/candidate/login?next=/jobs/${slug}/apply`);
  }

  if (user.role !== 'CANDIDATE') {
    redirect(getHomeRouteForRole(user.role));
  }

  const resumes = (await getCandidateResumeAssets()).filter((resume) => resume.status === 'ACTIVE');
  const { job, eligibility } = applyContext;

  if (!eligibility.canApply && eligibility.reasonCode !== 'RESUME_REQUIRED' && eligibility.reasonCode !== 'PROFILE_REQUIREMENTS_INCOMPLETE') {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-8 lg:px-10">
        <Card className="rounded-[32px] p-6">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Applications unavailable</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Reason: {eligibility.reasonCode || 'Unable to apply right now.'}</p>
          <Link href={`/jobs/${slug}`} className="mt-6 inline-flex rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Back to job</Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 lg:px-10">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Apply to {job.organisation?.name || 'Careeriz employer'}</p>
        <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">{job.title}</h1>
      </div>
      <JobApplicationFlow
        job={job}
        resumes={resumes}
        candidate={{
          fullName: user.candidateProfile?.fullName,
          email: user.email,
          currentTitle: user.candidateProfile?.currentTitle,
        }}
      />
    </main>
  );
}
