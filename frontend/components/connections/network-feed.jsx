"use client";

import { useState } from 'react';
import { Repeat2, Send, ThumbsUp, Trash2 } from 'lucide-react';
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

// Renders plain post text with http(s) links made clickable.
function LinkedText({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s<>"')]+)/g);
  return parts.map((part, index) => (/^https?:\/\//.test(part)
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-primary)] underline break-all">{part}</a>
    : <span key={index}>{part}</span>));
}

function FeedItem({ item, onReact, onDelete, pending }) {
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
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text)]"><LinkedText text={item.content} /></p>
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
        {item.canDelete ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onDelete(item)} leadingIcon={Trash2} className="ml-auto">
            Delete
          </Button>
        ) : null}
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
export function NetworkFeed({ initialItems = [], initialMeta = {}, jobs = [], canPost = false }) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [pendingId, setPendingId] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  function attachJob(slug) {
    if (!slug) return;
    const link = `${window.location.origin}/jobs/${slug}`;
    setDraft((current) => {
      if (current.includes(link)) return current;
      return current && !current.endsWith('\n') ? `${current}\n${link}` : `${current}${link}`;
    });
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    setPostError('');
    try {
      const response = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) throw new Error(body?.message || 'Could not publish your post.');
      setItems((current) => [body.data, ...current]);
      setDraft('');
    } catch (caught) {
      setPostError(caught.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(item) {
    const previous = items;
    setItems((current) => current.filter((entry) => entry.postId !== item.postId));
    try {
      const response = await fetch(`/api/feed/posts/${encodeURIComponent(item.postId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete failed');
    } catch {
      setItems(previous);
      setError('Could not delete the post.');
    }
  }

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
      {canPost ? (
        <Card className="rounded-2xl p-5">
          <form onSubmit={submitPost} className="grid gap-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Share an update with your network…"
              className="w-full resize-y rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Job openings can&apos;t be posted as text. To promote a job, attach its Careeriz job link.
            </p>
            {postError ? <Alert tone="danger" title="Post not published">{postError}</Alert> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {jobs.length ? (
                <select
                  aria-label="Attach a Careeriz job link"
                  className="max-w-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                  value=""
                  onChange={(event) => attachJob(event.target.value)}
                >
                  <option value="">Attach a job link…</option>
                  {jobs.map((job) => <option key={job.slug} value={job.slug}>{job.title}</option>)}
                </select>
              ) : <span />}
              <Button type="submit" loading={posting} disabled={!draft.trim()} leadingIcon={Send}>Post</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {error ? <Alert tone="danger" title="Something went wrong">{error}</Alert> : null}
      {items.length ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <FeedItem key={item.id} item={item} onReact={handleReact} onDelete={handleDelete} pending={pendingId === item.postId} />
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
