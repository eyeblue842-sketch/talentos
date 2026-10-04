import Link from 'next/link';
import { Bookmark, CalendarDays, ClipboardList, WalletCards } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Compact "your job activity" strip for the Find Jobs page: four shortcut tiles
// (Saved, Applications, Interviews, Offers) with live counts that deep-link to
// the matching tab. Gives candidates a quick status glance while browsing.
export function CandidateJobActivity({ saved = 0, applications = 0, interviews = 0, offers = 0 }) {
  const tiles = [
    { label: 'Saved jobs', count: saved, href: '/candidate/saved-jobs', icon: Bookmark },
    { label: 'Applications', count: applications, href: '/candidate/applications', icon: ClipboardList },
    { label: 'Interviews', count: interviews, href: '/candidate/interviews', icon: CalendarDays },
    { label: 'Offers', count: offers, href: '/candidate/offers', icon: WalletCards },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link key={tile.href} href={tile.href} className="group">
            <Card className="flex items-center justify-between gap-3 rounded-2xl p-4 transition group-hover:border-[var(--color-primary)] group-hover:shadow-[var(--shadow-md)]">
              <div>
                <p className="text-3xl font-semibold leading-none text-[var(--color-text)]">{tile.count}</p>
                <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{tile.label}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon size={20} aria-hidden="true" />
              </span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
