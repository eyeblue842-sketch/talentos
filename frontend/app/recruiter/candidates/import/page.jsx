import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportUploadExperience } from '@/components/resume-import/experience';
import { recruiterNav } from '@/lib/navigation';
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
        title="Resume Databank"
        description="Upload and parse resumes, review extracted candidate records, and add eligible profiles to your organisation's databank."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Resume Databank' }]}
        secondaryActions={[{ label: 'Import history', href: '/recruiter/candidates/import/history' }]}
      />
      <ResumeImportUploadExperience
        limits={getLimits()}
        batchHrefPrefix="/recruiter/candidates/import"
        historyHref="/recruiter/candidates/import/history"
      />
    </WorkspaceShell>
  );
}
