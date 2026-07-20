import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb = [],
  primaryAction,
  secondaryActions = [],
  className,
}) {
  return (
    <header className={cn('grid gap-4', className)}>
      {breadcrumb.length ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
          {breadcrumb.map((item, index) => (
            <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">{eyebrow}</p> : null}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--color-text)] md:text-4xl">{title}</h1>
          {description ? <p className="mt-2 text-base leading-7 text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
        {(primaryAction || secondaryActions.length) ? (
          <div className="flex flex-wrap items-center gap-3">
            {secondaryActions.map((action) => (
              <Button key={action.label} variant={action.variant || 'outline'} as={action.href ? 'a' : 'button'} href={action.href} onClick={action.onClick}>
                {action.icon ? <action.icon size={16} aria-hidden="true" /> : null}
                {action.label}
              </Button>
            ))}
            {primaryAction ? (
              <Button as={primaryAction.href ? 'a' : 'button'} href={primaryAction.href} onClick={primaryAction.onClick}>
                {primaryAction.icon ? <primaryAction.icon size={16} aria-hidden="true" /> : null}
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
