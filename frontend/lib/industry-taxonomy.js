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
  'Internet & Web Services',
  'Fintech',
  'Cybersecurity',
  'Artificial Intelligence & Data',
  'Biotechnology',
  'Medical Devices',
  'Renewable Energy',
  'Oil & Gas',
  'Mining & Metals',
  'Aerospace & Defence',
  'Food & Beverage',
  'Marketing, Advertising & PR',
  'Staffing & Recruitment',
  'Accounting & Audit',
  'Architecture & Design',
  'Shipping & Maritime',
  'Event Management',
  'Sports & Fitness',
  'Security Services',
  'Facility Management',
  'Packaging',
  'Printing & Publishing',
  'Furniture & Home Goods',
  'Jewellery & Luxury',
  'Research & Development',
  'Environment & Waste Management',
  'Other',
];

export function filterIndustries(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return INDUSTRY_TAXONOMY;
  return INDUSTRY_TAXONOMY.filter((industry) => industry.toLowerCase().includes(needle));
}

// Grouped tree for the CascadeSelect industry picker (group header -> industry
// leaf). Every leaf value is an exact string from INDUSTRY_TAXONOMY above, so
// previously-saved industry values keep matching and nothing is lost on read
// back. Groups are non-selectable branches; sub-industries can be layered in
// later by turning a leaf into a branch (keep a "<name> (General)" child with
// the original value to stay back-compatible).
export const INDUSTRY_GROUPS = [
  { group: 'Technology', industries: ['IT Services & Consulting', 'Software Product', 'BPO / ITES', 'Semiconductors & Electronics', 'Gaming', 'Telecommunications', 'Internet & Web Services', 'Fintech', 'Cybersecurity', 'Artificial Intelligence & Data'] },
  { group: 'Banking, Financial Services & Insurance', industries: ['Banking & Financial Services', 'Insurance'] },
  { group: 'Consumer, Retail & Hospitality', industries: ['E-commerce', 'FMCG', 'Retail', 'Hospitality & Travel', 'Food & Beverage', 'Jewellery & Luxury', 'Sports & Fitness', 'Event Management'] },
  { group: 'Healthcare & Life Sciences', industries: ['Healthcare & Hospitals', 'Pharmaceuticals & Life Sciences', 'Biotechnology', 'Medical Devices'] },
  { group: 'Manufacturing & Industrial', industries: ['Manufacturing', 'Automotive', 'Chemicals', 'Textiles & Apparel', 'Energy & Utilities', 'Renewable Energy', 'Oil & Gas', 'Mining & Metals', 'Aerospace & Defence', 'Packaging', 'Furniture & Home Goods'] },
  { group: 'Infrastructure, Real Estate & Logistics', industries: ['Real Estate', 'Construction & Engineering', 'Logistics & Supply Chain', 'Aviation', 'Shipping & Maritime', 'Facility Management'] },
  { group: 'Professional Services', industries: ['Consulting', 'Legal Services', 'Accounting & Audit', 'Architecture & Design', 'Marketing, Advertising & PR', 'Staffing & Recruitment', 'Security Services', 'Research & Development'] },
  { group: 'Media & Education', industries: ['Education & EdTech', 'Media & Entertainment', 'Printing & Publishing'] },
  { group: 'Government, Social & Agriculture', industries: ['Government / Public Sector', 'NGO / Non-Profit', 'Agriculture', 'Environment & Waste Management', 'Other'] },
];

export const INDUSTRY_TREE = INDUSTRY_GROUPS.map((entry) => ({
  label: entry.group,
  children: entry.industries.map((industry) => ({ label: industry, value: industry })),
}));
