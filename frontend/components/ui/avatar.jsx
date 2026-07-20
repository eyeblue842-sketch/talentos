import Image from 'next/image';
import { cn, getInitials } from '@/lib/utils';

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusStyles = {
  online: 'bg-emerald-500',
  busy: 'bg-rose-500',
  away: 'bg-amber-500',
};

export function Avatar({ src, alt = '', name = '', size = 'md', status, className }) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]', sizeStyles[size], className)}>
      {src ? (
        <Image src={src} alt={alt || name} fill sizes="64px" className="rounded-full object-cover" />
      ) : (
        <span aria-hidden="true">{getInitials(name) || 'CR'}</span>
      )}
      {status ? (
        <span className={cn('absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-white', statusStyles[status])} />
      ) : null}
    </span>
  );
}
