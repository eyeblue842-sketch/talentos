'use client';

import { useState } from 'react';
import { CandidateProfileForm } from '@/components/sections/candidate-profile-form';
import { CandidateProfileSnapshot, CandidateResumeSummaryCard } from '@/components/sections/candidate-profile-snapshot';
import { CandidateResumeSuggestionBanner } from '@/components/sections/candidate-resume-suggestion-banner';

export function CandidateProfilePageContent({ profile, snapshot, resumeSuggestions }) {
  const [activeSection, setActiveSection] = useState(null);

  return (
    <>
      <CandidateProfileSnapshot snapshot={snapshot} onEdit={() => setActiveSection('profile-snapshot')} />
      <CandidateResumeSummaryCard snapshot={snapshot} />
      <CandidateResumeSuggestionBanner suggestions={resumeSuggestions} compact />
      <CandidateProfileForm
        profile={profile}
        activeSection={activeSection}
        onActiveSectionChange={setActiveSection}
      />
    </>
  );
}
