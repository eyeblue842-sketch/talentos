import { cn } from '@/lib/utils';

const sizeStyles = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export function Spinner({ size = 'md', className, label = 'Loading' }) {
  return (
    <span className={cn('inline-flex items-center justify-center', className)} role="status" aria-label={label}>
      <span
        aria-hidden="true"
        className={cn(
          'animate-spin rounded-full border-current border-r-transparent motion-reduce:animate-none',
          sizeStyles[size],
        )}
      />
    </span>
  );
}
