import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportBatchDetailExperience } from '@/components/resume-import/experience';
import { recruiterNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getCurrentOrganisation, getResumeImportBatch, getResumeImportBatchItems } from '@/lib/api';

export default async function RecruiterResumeImportBatchPage({ params, searchParams }) {
  const { batchId } = await params;
  const query = await searchParams;
  const organisation = await getCurrentOrganisation().catch(() => null);

  let batch = null;
  let items = [];
  let meta = null;

  if (isFeatureEnabled('bulkResumeImport')) {
    [batch, { items, meta }] = await Promise.all([
      getResumeImportBatch(batchId).catch(() => null),
      getResumeImportBatchItems(batchId, { ...(query || {}), pageSize: query?.pageSize || 100 }).catch(() => ({ items: [], meta: null })),
    ]);
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Candidate management'}
        title={batch ? `Import batch ${batch.id}` : 'Import batch'}
        description="Monitor item-level progress, open parsed candidate reviews, retry failures, and export safe failure reports."
        breadcrumb={[
          { label: 'Recruiter' },
          { label: 'Bulk Resume Import', href: '/recruiter/candidates/import' },
          { label: 'History', href: '/recruiter/candidates/import/history' },
          { label: batchId },
        ]}
        secondaryActions={[{ label: 'History', href: '/recruiter/candidates/import/history' }]}
      />
      {isFeatureEnabled('bulkResumeImport') && batch ? (
        <ResumeImportBatchDetailExperience
          initialBatch={batch}
          initialItems={items || []}
          initialMeta={meta}
          initialQuery={query || {}}
          batchId={batchId}
          historyHref="/recruiter/candidates/import/history"
          itemHrefBase={`/recruiter/candidates/import/${batchId}/items`}
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref="/recruiter/candidates/import/history" />
      )}
    </WorkspaceShell>
  );
}

