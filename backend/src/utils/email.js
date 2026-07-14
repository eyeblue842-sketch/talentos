const personalEmailDomains = new Set([
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
