import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function AccessEntryCard({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  bullets,
  accentClassName = 'text-[var(--color-primary)]',
  surfaceClassName = 'bg-[linear-gradient(180deg,#ffffff_0%,#f4f1ff_100%)]',
}) {
  return (
    <section className="flex min-h-[calc(100vh-6.5rem)] items-center">
      <Card className={`mx-auto w-full max-w-3xl p-6 shadow-[var(--shadow-lg)] md:p-8 ${surfaceClassName}`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={`text-sm font-semibold uppercase tracking-[0.22em] ${accentClassName}`}>{eyebrow}</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)] md:text-lg">
            {description}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button as="a" href={primaryHref} size="lg" className="min-w-[14rem]">
              {primaryLabel}
            </Button>
            <Button as="a" href={secondaryHref} variant="outline" size="lg" className="min-w-[14rem]">
              {secondaryLabel}
            </Button>
          </div>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            {bullets.map((bullet) => (
              <div key={bullet} className="rounded-[18px] border border-[var(--color-border)] bg-white/84 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                {bullet}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}
