// Exported so domainPolicyService.js (the single authoritative source for
// employer-registration domain decisions) can reuse this list instead of
// maintaining a second copy. Frontend code must never duplicate this list -
// see domainPolicyService.js's module doc comment.
export const personalEmailDomains = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'rediffmail.com',
]);

export function getEmailDomain(email = '') {
  const [, domain = ''] = email.toLowerCase().trim().split('@');
  return domain;
}

export function isPersonalEmail(email = '') {
  return personalEmailDomains.has(getEmailDomain(email));
}

export function normalizeOfficeLocations(locations = []) {
  if (!Array.isArray(locations)) return [];
  return locations
    .map((location) => String(location).trim())
    .filter(Boolean);
}
