import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SectionHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text)] md:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      {action ? (
        <Button variant={action.variant || 'outline'} as={action.href ? 'a' : 'button'} href={action.href} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
