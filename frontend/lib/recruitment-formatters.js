import { formatCandidateAnnualCtc } from '@/lib/ctc';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatRecruitmentDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return dateFormatter.format(date);
}

export function formatRelativeRecruitmentDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return formatRecruitmentDate(value);
}

export function formatJobExperienceRange(job) {
  if (!job) return 'Experience not specified';
  if (job.experienceMin === job.experienceMax) {
    return `${job.experienceMin} Years`;
  }
  return `${job.experienceMin}-${job.experienceMax} Years`;
}

export function formatJobSalaryRange(job) {
  if (!job || job.salaryMin == null || job.salaryMax == null) {
    return 'Salary not disclosed';
  }

  const min = formatCandidateAnnualCtc(job.salaryMin).replace(' per annum', '');
  const max = formatCandidateAnnualCtc(job.salaryMax).replace(' per annum', '');
  if (job.salaryMin === job.salaryMax) {
    return `${min} per annum`;
  }
  return `${min} - ${max} per annum`;
}

export function formatEmploymentLabel(value) {
  return String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Not specified';
}

export function formatApplicantCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'No applicants yet';
  return `${numeric} applicant${numeric === 1 ? '' : 's'}`;
}
