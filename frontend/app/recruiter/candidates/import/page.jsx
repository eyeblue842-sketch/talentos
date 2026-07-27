import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportUploadExperience } from '@/components/resume-import/experience';
import { recruiterNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getCurrentOrganisation } from '@/lib/api';

function getLimits() {
  return {
    maxFiles: Number(process.env.RESUME_IMPORT_MAX_FILES || 100),
    maxFileSizeMb: Number(process.env.RESUME_MAX_FILE_SIZE_MB || 10),
    maxZipSizeMb: Number(process.env.RESUME_IMPORT_MAX_ZIP_SIZE_MB || 100),
    maxFileSizeBytes: Number(process.env.RESUME_MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
    maxZipSizeBytes: Number(process.env.RESUME_IMPORT_MAX_ZIP_SIZE_MB || 100) * 1024 * 1024,
  };
}

export default async function RecruiterResumeImportPage() {
  const organisation = await getCurrentOrganisation().catch(() => null);

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Candidate management'}
        title="Bulk Resume Import"
        description="Upload multiple resumes or one ZIP archive, create a batch reference immediately, and review parsed candidate records as processing completes."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Bulk Resume Import' }]}
        secondaryActions={[{ label: 'Import history', href: '/recruiter/candidates/import/history' }]}
      />
      {isFeatureEnabled('bulkResumeImport') ? (
        <ResumeImportUploadExperience
          limits={getLimits()}
          batchHrefPrefix="/recruiter/candidates/import"
          historyHref="/recruiter/candidates/import/history"
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref="/recruiter" />
      )}
    </WorkspaceShell>
  );
}

