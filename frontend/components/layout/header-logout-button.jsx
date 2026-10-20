"use client";

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Always-visible logout in the top-right bar of the workspace shells, so any
// signed-in user can sign out without opening the sidebar or a menu.
export function HeaderLogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Recruiters return through the employer chooser (same as the sidebar logout).
      router.replace(pathname.startsWith('/recruiter') ? '/hire' : '/auth');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="h-11" onClick={handleLogout} leadingIcon={LogOut} disabled={pending} aria-label="Logout">
      {pending ? 'Logging out...' : 'Logout'}
    </Button>
  );
}
