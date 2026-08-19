"use client";

/**
 * Continuous-form section primitive shared across the recruiter Resume Search
 * criteria page. Deliberately NOT a Card - the page is one continuous form,
 * not a stack of separate cards (see recruiter-resume-search-page.jsx).
 */
export function FormSection({ title, description, children }) {
  return (
    <section className="border-t border-[var(--color-border)] pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      {description ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function CollapsibleFormSection({ title, description, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="border-t border-[var(--color-border)] pt-5 first:border-t-0 first:pt-0">
      <summary className="cursor-pointer list-none marker:content-none">
        <h3 className="inline text-sm font-semibold text-[var(--color-text)]">{title}</h3>
        {description ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p> : null}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
