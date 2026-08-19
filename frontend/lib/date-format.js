const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatCareerizDate(value, fallback = 'Not available') {
  const date = parseDate(value);
  if (!date) return fallback;

  const day = date.getUTCDate();
  const month = MONTHS_SHORT[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${day} ${month} ${year}`;
}

export function formatCareerizUpdatedLabel(value, fallback = 'Not available', now = new Date()) {
  const date = parseDate(value);
  if (!date) return fallback;

  if (
    date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth()
    && date.getUTCDate() === now.getUTCDate()
  ) {
    return 'Today';
  }

  return formatCareerizDate(date, fallback);
}
