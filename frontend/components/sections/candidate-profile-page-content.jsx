'use client';

import { useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { CandidateProfileForm } from '@/components/sections/candidate-profile-form';
import { CandidateProfileSnapshot, CandidateResumeSummaryCard } from '@/components/sections/candidate-profile-snapshot';
import { CandidateResumeSuggestionBanner } from '@/components/sections/candidate-resume-suggestion-banner';

// Sections the dashboard (or any link) can open directly with /candidate/profile?edit=<section>.
const EDITABLE_SECTIONS = new Set([
  'profile-snapshot', 'resume-headline', 'key-skills', 'employment', 'education', 'projects',
  'profile-summary', 'certifications', 'career-profile', 'personal-details', 'privacy',
]);

function subscribeNever() {
  return () => {};
}

export function CandidateProfilePageContent({ profile, snapshot, resumeSuggestions }) {
  const requestedSection = useSearchParams().get('edit');
  // false while rendering on the server and hydrating, true afterwards: the requested editor
  // must only open once hydration is done, otherwise server and client disagree about the dialog.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [chosenSection, setActiveSection] = useState(undefined);
  const activeSection = chosenSection !== undefined
    ? chosenSection
    : (hydrated && EDITABLE_SECTIONS.has(requestedSection) ? requestedSection : null);

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
