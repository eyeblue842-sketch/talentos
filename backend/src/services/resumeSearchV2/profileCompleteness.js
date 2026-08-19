import { normalizeCandidateProfileForPresentation } from '../candidateProfileSanitizer.js';

const PROFILE_COMPLETENESS_COMPONENTS = Object.freeze([
  { key: 'currentTitle', label: 'Current title', weight: 15 },
  { key: 'skills', label: 'Skills', weight: 20 },
  { key: 'employmentHistory', label: 'Employment history', weight: 20 },
  { key: 'totalExperience', label: 'Total experience', weight: 10 },
  { key: 'education', label: 'Education', weight: 10 },
  { key: 'location', label: 'Location', weight: 10 },
  { key: 'certificationsLanguages', label: 'Certifications or languages', weight: 5 },
  { key: 'professionalSummary', label: 'Professional summary', weight: 10 },
]);

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function hasArray(values, min = 1) {
  return Array.isArray(values) && values.filter(Boolean).length >= min;
}

function hasExperienceEntries(entries = []) {
  return Array.isArray(entries) && entries.some((entry) => hasText(entry?.title) || hasText(entry?.company) || hasText(entry?.summary));
}

function hasEducationEntries(entries = []) {
  return Array.isArray(entries) && entries.some((entry) => hasText(entry?.degree) || hasText(entry?.institution));
}

function buildComponentStates(profile) {
  const safe = normalizeCandidateProfileForPresentation(profile) || {};

  return {
    currentTitle: hasText(safe.currentTitle || safe.headline),
    skills: hasArray([
      ...(safe.skills || []),
      ...(safe.functionalSkills || []),
      ...(safe.tools || []),
      ...(safe.frameworks || []),
      ...(safe.cloudPlatforms || []),
      ...(safe.databases || []),
    ], 2),
    employmentHistory: hasExperienceEntries(safe.experienceEntries),
    totalExperience: Number.isFinite(Number(safe.totalExperience)) && Number(safe.totalExperience) > 0,
    education: hasEducationEntries(safe.educationEntries),
    location: hasText(safe.location || safe.currentCity || safe.currentState || safe.currentCountry),
    certificationsLanguages: hasArray(safe.certificationEntries) || hasArray(safe.languageEntries),
    professionalSummary: hasText(safe.summary || safe.headline),
  };
}

export function calculateResumeSearchProfileCompleteness(profile) {
  const states = buildComponentStates(profile);
  const breakdown = PROFILE_COMPLETENESS_COMPONENTS.map((component) => ({
    ...component,
    complete: Boolean(states[component.key]),
  }));
  const score = Math.max(0, Math.min(100, Math.round(
    breakdown.reduce((total, component) => total + (component.complete ? component.weight : 0), 0),
  )));

  return {
    score,
    components: breakdown,
  };
}

export function getResumeSearchProfileCompletenessComponents() {
  return PROFILE_COMPLETENESS_COMPONENTS.map((component) => ({ ...component }));
}
