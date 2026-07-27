import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportItemReviewExperience } from '@/components/resume-import/experience';
import { recruiterNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getCurrentOrganisation, getRecruiterCandidatePreview, getResumeImportBatch, getResumeImportItem } from '@/lib/api';

export default async function RecruiterResumeImportItemPage({ params }) {
  const { batchId, itemId } = await params;
  const organisation = await getCurrentOrganisation().catch(() => null);

  let batch = null;
  let item = null;
  let existingCandidatePreview = null;

  if (isFeatureEnabled('bulkResumeImport')) {
    batch = await getResumeImportBatch(batchId).catch(() => null);
    item = await getResumeImportItem(batchId, itemId).catch(() => null);
    if (item?.duplicateCandidateId) {
      existingCandidatePreview = await getRecruiterCandidatePreview(item.duplicateCandidateId).catch(() => null);
    }
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Candidate management'}
        title={item?.originalFilename || 'Resume import item'}
        description="Review parsed candidate details, confirm profile creation, retry failures, reject invalid resumes, and resolve duplicates securely."
        breadcrumb={[
          { label: 'Recruiter' },
          { label: 'Bulk Resume Import', href: '/recruiter/candidates/import' },
          { label: 'History', href: '/recruiter/candidates/import/history' },
          { label: batchId, href: `/recruiter/candidates/import/${batchId}` },
          { label: itemId },
        ]}
        secondaryActions={[{ label: 'Back to batch', href: `/recruiter/candidates/import/${batchId}` }]}
      />
      {isFeatureEnabled('bulkResumeImport') && batch && item ? (
        <ResumeImportItemReviewExperience
          initialBatch={batch}
          initialItem={item}
          existingCandidatePreview={existingCandidatePreview}
          historyHref="/recruiter/candidates/import/history"
          batchHref={`/recruiter/candidates/import/${batchId}`}
          candidateProfileHrefBase="/recruiter/database"
          aiEnabled={isFeatureEnabled('aiResumeParsing')}
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref={`/recruiter/candidates/import/${batchId}`} />
      )}
    </WorkspaceShell>
  );
}

