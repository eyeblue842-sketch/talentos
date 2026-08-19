'use client';

import Link from 'next/link';
import {
  acceptConnectionRequestAction,
  blockUserAction,
  declineConnectionRequestAction,
  removeConnectionAction,
  sendConnectionRequestAction,
  withdrawConnectionRequestAction,
} from '@/app/network/actions';
import { Button } from '@/components/ui/button';

export function NetworkProfileActions({
  profile,
  redirectTo,
  source = 'PROFILE',
  allowViewProfile = true,
  allowBlock = true,
  messageLabel = 'Message',
  messageHref = '',
  className = '',
}) {
  if (!profile) return null;

  const actionLabelName = profile.fullName || 'this user';

  return (
    <div className={`flex shrink-0 flex-col gap-2 ${className}`.trim()}>
      {allowViewProfile ? (
        <Link
          href={`/network/people/${profile.userId}`}
          data-testid={`network-view-profile-${profile.userId}`}
          className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)]"
        >
          View profile
        </Link>
      ) : null}

      {profile.connectionStatus === 'NONE' && !profile.isSelf && profile.canConnect ? (
        <form action={sendConnectionRequestAction}>
          <input type="hidden" name="targetUserId" value={profile.userId} />
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button type="submit" data-testid={`network-connect-${profile.userId}`} aria-label={`Connect with ${actionLabelName}`} className="w-full">Connect</Button>
        </form>
      ) : null}

      {profile.connectionStatus === 'PENDING' && profile.pendingDirection === 'OUTGOING' ? (
        <form action={withdrawConnectionRequestAction}>
          <input type="hidden" name="requestId" value={profile.requestId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button type="submit" data-testid={`network-withdraw-${profile.userId}`} aria-label={`Withdraw request to ${actionLabelName}`} variant="outline" className="w-full">Withdraw</Button>
        </form>
      ) : null}

      {profile.connectionStatus === 'PENDING' && profile.pendingDirection === 'INCOMING' ? (
        <div className="grid gap-2">
          <form action={acceptConnectionRequestAction}>
            <input type="hidden" name="requestId" value={profile.requestId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" data-testid={`network-accept-${profile.userId}`} aria-label={`Accept connection request from ${actionLabelName}`} className="w-full">Accept</Button>
          </form>
          <form action={declineConnectionRequestAction}>
            <input type="hidden" name="requestId" value={profile.requestId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" data-testid={`network-decline-${profile.userId}`} aria-label={`Decline connection request from ${actionLabelName}`} variant="outline" className="w-full">Decline</Button>
          </form>
        </div>
      ) : null}

      {profile.connectionStatus === 'ACCEPTED' ? (
        <>
          {profile.canMessage?.enabled && profile.canMessage?.allowed ? (
            <Link
              href={messageHref || '#'}
              data-testid={`network-message-${profile.userId}`}
              aria-label={`${messageLabel} ${actionLabelName}`}
              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary)]"
            >
              {messageLabel}
            </Link>
          ) : null}
          <form action={removeConnectionAction}>
            <input type="hidden" name="connectionId" value={profile.connectionId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" data-testid={`network-remove-${profile.userId}`} aria-label={`Remove connection with ${actionLabelName}`} variant="outline" className="w-full">Remove</Button>
          </form>
        </>
      ) : null}

      {allowBlock && !profile.isSelf && profile.connectionStatus !== 'BLOCKED' ? (
        <form action={blockUserAction}>
          <input type="hidden" name="userId" value={profile.userId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button type="submit" data-testid={`network-block-${profile.userId}`} aria-label={`Block ${actionLabelName}`} variant="ghost" className="w-full text-rose-700">Block</Button>
        </form>
      ) : null}
    </div>
  );
}
