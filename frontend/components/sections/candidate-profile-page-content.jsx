'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CandidateProfileForm } from '@/components/sections/candidate-profile-form';
import { CandidateProfileSnapshot, CandidateResumeSummaryCard } from '@/components/sections/candidate-profile-snapshot';
import { CandidateResumeSuggestionBanner } from '@/components/sections/candidate-resume-suggestion-banner';

// Sections the dashboard (or any link) can open directly with /candidate/profile?edit=<section>.
const EDITABLE_SECTIONS = new Set([
  'profile-snapshot', 'resume-headline', 'key-skills', 'employment', 'education', 'projects',
  'profile-summary', 'certifications', 'career-profile', 'personal-details', 'privacy',
]);

export function CandidateProfilePageContent({ profile, snapshot, resumeSuggestions }) {
  const requestedSection = useSearchParams().get('edit');
  const [activeSection, setActiveSection] = useState(() => (EDITABLE_SECTIONS.has(requestedSection) ? requestedSection : null));

  return (
    <>
      <CandidateProfileSnapshot snapshot={snapshot} onEdit={() => setActiveSection('profile-snapshot')} />
      {/* The resume summary + suggestions render inside the form, right after the
          Career profile section, so Career profile sits above the Resume box. */}
      <CandidateProfileForm
        profile={profile}
        activeSection={activeSection}
        onActiveSectionChange={setActiveSection}
        resumeSlot={(
          <>
            <CandidateResumeSummaryCard snapshot={snapshot} />
            <CandidateResumeSuggestionBanner suggestions={resumeSuggestions} compact />
          </>
        )}
      />
    </>
  );
}
