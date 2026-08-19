import { cn } from '@/lib/utils';

const variantStyles = {
  default: 'border-[var(--color-border)] bg-white shadow-[var(--shadow-md)]',
  interactive: 'border-[var(--color-border)] bg-white shadow-[var(--shadow-md)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-lg)]',
  muted: 'border-transparent bg-[var(--color-bg-muted)] shadow-none',
  outlined: 'border-[var(--color-border-strong)] bg-white shadow-none',
  elevated: 'border-[var(--color-border)] bg-white shadow-[var(--shadow-floating)]',
};

export function Card({ children, className, variant = 'default', as: Comp = 'div', ...props }) {
  return (
    <Comp
      className={cn('rounded-[var(--radius-card)] border p-5', variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Comp>
  );
}

