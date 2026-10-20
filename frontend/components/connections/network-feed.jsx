"use client";

import { useState } from 'react';
import { Repeat2, ThumbsUp } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function FeedItem({ item, onReact, pending }) {
  return (
    <Card className="rounded-2xl p-5">
      {item.activity ? (
        <p className="mb-3 text-xs font-medium text-[var(--color-text-muted)]">
          {item.activity.byName} {item.activity.type === 'SHARED' ? 'shared this' : 'liked this'}
        </p>
      ) : null}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-semibold text-[var(--color-primary)]" aria-hidden="true">
          {initials(item.author.name)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-[var(--color-text)]">{item.author.name}</p>
            <Badge tone={item.author.role === 'RECRUITER' ? 'brand' : 'neutral'}>{item.author.role === 'RECRUITER' ? 'Recruiter' : 'Candidate'}</Badge>
          </div>
          <p className="truncate text-sm text-[var(--color-text-secondary)]">{item.author.subtitle}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{timeAgo(item.createdAt)}</p>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text)]">{item.content}</p>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="mt-4 max-h-96 w-full rounded-xl object-cover" />
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-pressed={item.viewerLiked}
          onClick={() => onReact(item, 'LIKE')}
          className={cn(item.viewerLiked && 'text-[var(--color-primary)]')}
          leadingIcon={ThumbsUp}
        >
          {item.viewerLiked ? 'Liked' : 'Like'}{item.likeCount ? ` · ${item.likeCount}` : ''}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-pressed={item.viewerShared}
          onClick={() => onReact(item, 'SHARE')}
          className={cn(item.viewerShared && 'text-[var(--color-primary)]')}
          leadingIcon={Repeat2}
        >
          {item.viewerShared ? 'Shared' : 'Share'}{item.shareCount ? ` · ${item.shareCount}` : ''}
        </Button>
      </div>
    </Card>
  );
}

// Feed of the viewer's connections: their posts plus what they liked or shared.
export function NetworkFeed({ initialItems = [], initialMeta = {} }) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [pendingId, setPendingId] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  async function handleReact(item, type) {
    setPendingId(item.postId);
    setError('');
    try {
      const response = await fetch(`/api/feed/posts/${encodeURIComponent(item.postId)}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Could not update your reaction.');
      const result = body.data;
      setItems((current) => current.map((entry) => (entry.postId === item.postId
        ? {
          ...entry,
          likeCount: result.likeCount,
          shareCount: result.shareCount,
          viewerLiked: type === 'LIKE' ? result.active : entry.viewerLiked,
          viewerShared: type === 'SHARE' ? result.active : entry.viewerShared,
        }
        : entry)));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPendingId('');
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    setError('');
    try {
      const nextPage = (meta.page || 1) + 1;
      const response = await fetch(`/api/feed/network?page=${nextPage}&pageSize=${meta.pageSize || 10}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Could not load more posts.');
      setItems((current) => {
        const seen = new Set(current.map((entry) => entry.postId));
        return [...current, ...body.data.items.filter((entry) => !seen.has(entry.postId))];
      });
      setMeta(body.data.meta);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Feed</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Posts from the candidates you are connected with, and posts they have liked or shared.</p>
      </div>
      {error ? <Alert tone="danger" title="Something went wrong">{error}</Alert> : null}
      {items.length ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <FeedItem key={item.id} item={item} onReact={handleReact} pending={pendingId === item.postId} />
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl p-8 text-center">
          <p className="font-semibold">Your feed is empty</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {meta.connectionCount
              ? 'None of your connections have posted yet. Posts and activity will appear here.'
              : 'Connect with candidates from the Discover tab to see their posts and activity here.'}
          </p>
        </Card>
      )}
      {meta.hasMore ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore} loading={loadingMore}>Load more</Button>
        </div>
      ) : null}
    </div>
  );
}
