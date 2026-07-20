import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}) {
  return (
    <div className={cn('grid justify-items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-white px-6 py-10 text-center', className)}>
      {Icon ? (
        <div className="rounded-full bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
          <Icon size={22} aria-hidden="true" />
        </div>
      ) : null}
      <div className="grid gap-2">
        <h3 className="text-xl font-semibold text-[var(--color-text)]">{title}</h3>
        {description ? <p className="max-w-md text-sm leading-6 text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryAction ? <Button onClick={primaryAction.onClick} as={primaryAction.href ? 'a' : 'button'} href={primaryAction.href}>{primaryAction.label}</Button> : null}
        {secondaryAction ? <Button variant="outline" onClick={secondaryAction.onClick} as={secondaryAction.href ? 'a' : 'button'} href={secondaryAction.href}>{secondaryAction.label}</Button> : null}
      </div>
    </div>
  );
}
