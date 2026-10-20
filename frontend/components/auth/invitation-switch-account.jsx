"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Signs the current account out, then reloads the invitation page so the invitee
// can sign in (or register) with the address the invitation was sent to.
export function InvitationSwitchAccount({ returnTo }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign(returnTo);
    }
  }

  return (
    <Button type="button" onClick={handleClick} loading={pending}>
      Sign out and continue
    </Button>
  );
}
