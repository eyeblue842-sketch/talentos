// Locations are stored as "City, State" (the comma keeps same-named districts in different states
// apart). For display, "City - State" reads as one item instead of two entries in a comma list.
export function formatLocationLabel(value) {
  return String(value || '').trim().replace(/\s*,\s*/, ' - ');
}

export function formatLocationList(values = []) {
  return (Array.isArray(values) ? values : []).map(formatLocationLabel).filter(Boolean).join(', ');
}
