// Careeriz-maintained industry list for the recruiter Resume Search "Industry" filter.
// Backend support: candidateSearchFilterService.filterCandidateRows matches
// filters.industry (loose text) against CandidateProfile.preferredIndustries.
export const INDUSTRY_TAXONOMY = [
  'IT Services & Consulting',
  'Software Product',
  'BPO / ITES',
  'Banking & Financial Services',
  'Insurance',
  'E-commerce',
  'Healthcare & Hospitals',
  'Pharmaceuticals & Life Sciences',
  'Manufacturing',
  'Automotive',
  'FMCG',
  'Retail',
  'Telecommunications',
  'Real Estate',
  'Construction & Engineering',
  'Education & EdTech',
  'Media & Entertainment',
  'Hospitality & Travel',
  'Logistics & Supply Chain',
  'Energy & Utilities',
  'Consulting',
  'Legal Services',
  'Government / Public Sector',
  'NGO / Non-Profit',
  'Aviation',
  'Agriculture',
  'Textiles & Apparel',
  'Chemicals',
  'Semiconductors & Electronics',
  'Gaming',
];

export function filterIndustries(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return INDUSTRY_TAXONOMY;
  return INDUSTRY_TAXONOMY.filter((industry) => industry.toLowerCase().includes(needle));
}
