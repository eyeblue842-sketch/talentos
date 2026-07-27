import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportItemReviewExperience } from '@/components/resume-import/experience';
import { adminNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getRecruiterCandidatePreview, getResumeImportBatch, getResumeImportItem } from '@/lib/api';

export default async function AdminResumeImportItemPage({ params }) {
  const { batchId, itemId } = await params;

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
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader
        eyebrow="Candidate management"
        title={item?.originalFilename || 'Resume import item'}
        description="Edit parsed data, confirm imported candidates, resolve duplicates, and manage secure resume downloads."
        breadcrumb={[
          { label: 'Admin' },
          { label: 'Bulk Resume Import', href: '/admin/candidates/import' },
          { label: 'History', href: '/admin/candidates/import/history' },
          { label: batchId, href: `/admin/candidates/import/${batchId}` },
          { label: itemId },
        ]}
      />
      {isFeatureEnabled('bulkResumeImport') && batch && item ? (
        <ResumeImportItemReviewExperience
          initialBatch={batch}
          initialItem={item}
          existingCandidatePreview={existingCandidatePreview}
          historyHref="/admin/candidates/import/history"
          batchHref={`/admin/candidates/import/${batchId}`}
          candidateProfileHrefBase="/admin/candidates"
          aiEnabled={isFeatureEnabled('aiResumeParsing')}
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref={`/admin/candidates/import/${batchId}`} />
      )}
    </WorkspaceShell>
  );
}
