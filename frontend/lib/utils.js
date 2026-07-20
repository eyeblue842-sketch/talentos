import clsx from 'clsx';

export function cn(...inputs) {
  return clsx(inputs);
}

export function getInitials(value = '') {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}
