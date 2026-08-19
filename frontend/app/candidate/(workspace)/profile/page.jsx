import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Badge } from '@/components/ui/badge';
import { CandidateProfilePageContent } from '@/components/sections/candidate-profile-page-content';
import { candidateNav } from '@/lib/navigation';
import { getCandidateProfile } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';

export default async function CandidateProfilePage() {
  const { profile, completion, snapshot, resumeSuggestions } = await getCandidateProfile();
  const profileLinks = [
    { id: 'profile-snapshot', label: 'Profile Snapshot', href: '#profile-snapshot' },
    { id: 'resume', label: 'Resume', href: '#resume' },
    { id: 'resume-headline', label: 'Resume Headline', href: '#resume-headline' },
    { id: 'profile-summary', label: 'Profile Summary', href: '#profile-summary' },
    { id: 'key-skills', label: 'Key Skills', href: '#key-skills' },
    { id: 'employment', label: 'Employment', href: '#employment' },
    { id: 'education', label: 'Education', href: '#education' },
    { id: 'it-skills', label: 'IT Skills', href: '#it-skills' },
    { id: 'projects', label: 'Projects', href: '#projects' },
    { id: 'certifications', label: 'Certifications', href: '#certifications' },
    { id: 'career-profile', label: 'Career Profile', href: '#career-profile' },
    { id: 'personal-details', label: 'Personal Details', href: '#personal-details' },
  ];

  return (
    <WorkspaceShell
      brand="Careeriz"
      items={candidateNav}
      sidebarProfileLinks={profileLinks}
      defaultProfileExpanded
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Candidate profile"
          breadcrumb={[{ label: 'Candidate' }, { label: 'Profile' }]}
        />
        <Badge tone="brand">{completion.percentage}% complete</Badge>
      </div>
      <CandidateProfilePageContent
        profile={profile}
        snapshot={snapshot}
        resumeSuggestions={resumeSuggestions}
      />
    </WorkspaceShell>
  );
}
