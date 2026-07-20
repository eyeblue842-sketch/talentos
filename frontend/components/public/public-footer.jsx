import Link from 'next/link';

const footerGroups = [
  {
    title: 'Platform',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Careeriz Jobs', href: '/candidate' },
      { label: 'Careeriz Hire', href: '/hire' },
      { label: 'Jobs', href: '/jobs' },
      { label: 'Companies', href: '/companies' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { label: 'Career Tools', href: '/career-tools' },
      { label: 'Candidate Sign In', href: '/auth/candidate/login' },
      { label: 'Create Profile', href: '/auth/candidate/register' },
      { label: 'Employer Sign In', href: '/hire/login' },
      { label: 'Create Workspace', href: '/hire/register' },
    ],
  },
];

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] bg-white/84 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1.2fr_1.4fr] lg:px-10">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[var(--color-primary-soft)] text-lg font-semibold text-[var(--color-primary)]">
              C
            </span>
            <div>
              <p className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-text)]">Careeriz</p>
              <p className="text-sm text-[var(--color-text-secondary)]">AI-Powered Talent Intelligence Platform</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">
            Careeriz connects intelligent career growth for candidates with modern hiring workflows for employers.
          </p>
          <p className="mt-6 text-sm text-[var(--color-text-muted)]">© {year} Careeriz. All rights reserved.</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{group.title}</p>
              <div className="mt-4 grid gap-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-primary)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
