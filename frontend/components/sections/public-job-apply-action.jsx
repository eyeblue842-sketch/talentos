import Link from 'next/link';

export function getApplyStateLabel(user, eligibility) {
  if (!user) return eligibility?.requiresLogin ? 'Login to Apply' : 'Apply Now';
  if (eligibility?.reasonCode === 'ALREADY_APPLIED') return 'Already Applied';
  if (eligibility?.reasonCode === 'APPLICATION_NOT_OPEN') return 'Applications Not Yet Open';
  if (eligibility?.reasonCode === 'APPLICATION_CLOSED') return 'Applications Closed';
  if (eligibility?.reasonCode === 'JOB_CLOSED') return 'Job Closed';
  if (eligibility?.reasonCode === 'RESUME_REQUIRED') return 'Resume Required';
  if (eligibility?.reasonCode === 'PROFILE_REQUIREMENTS_INCOMPLETE') return 'Complete Profile to Apply';
  return 'Apply Now';
}

export function getApplyHref(user, eligibility, slug) {
  if (!user) return `/auth/candidate/login?next=/jobs/${slug}/apply`;
  if (eligibility?.canApply || ['RESUME_REQUIRED', 'PROFILE_REQUIREMENTS_INCOMPLETE'].includes(eligibility?.reasonCode)) {
    return `/jobs/${slug}/apply`;
  }
  return null;
}

export function PublicJobApplyAction({ user, eligibility, slug }) {
  const label = getApplyStateLabel(user, eligibility);
  const href = getApplyHref(user, eligibility, slug);

  if (href) {
    const className = user
      ? 'block rounded-2xl border border-[var(--line)] px-5 py-3 text-center font-semibold text-[var(--text)]'
      : 'block rounded-2xl bg-[var(--brand)] px-5 py-3 text-center font-semibold text-white';
    return <Link href={href} className={className}>{label}</Link>;
  }

  return <span className="block rounded-2xl border border-[var(--line)] px-5 py-3 text-center font-semibold text-[var(--muted)]">{label}</span>;
}
