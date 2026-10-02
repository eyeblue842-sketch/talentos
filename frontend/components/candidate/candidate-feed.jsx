"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, Send, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function initials(name) {
  return String(name || 'C')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function Avatar({ item }) {
  const { logoUrl, name } = item.author || {};
  if (logoUrl) {
    return <img src={logoUrl} alt={name || 'Company'} className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-semibold text-[var(--color-primary)]">
      {item.type === 'ORGANISATION' ? <Building2 size={18} aria-hidden="true" /> : initials(name)}
    </span>
  );
}

export function CandidateFeed({ initialItems = [], initialMeta = {} }) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImage, setShowImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  async function submitPost(event) {
    event.preventDefault();
    if (!content.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      const response = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), imageUrl: imageUrl.trim() || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not publish your post.');
      setItems((current) => [body.data, ...current]);
      setContent('');
      setImageUrl('');
      setShowImage(false);
    } catch (postError) {
      setError(postError.message);
    } finally {
      setPosting(false);
    }
  }

  async function removePost(item) {
    if (!item.canDelete) return;
    const previous = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      const response = await fetch(`/api/feed/posts/${item.postId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete failed');
    } catch {
      setItems(previous); // restore on failure
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = (meta.page || 1) + 1;
      const response = await fetch(`/api/feed?page=${nextPage}&pageSize=${meta.pageSize || 10}`);
      const body = await response.json().catch(() => ({}));
      if (response.ok && body?.data) {
        setItems((current) => [...current, ...(body.data.items || [])]);
        setMeta(body.data.meta || meta);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="grid gap-5">
      {/* Composer */}
      <Card className="rounded-2xl p-5">
        <form onSubmit={submitPost} className="grid gap-3">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="Share an update, a win, or what you're looking for…"
            className="w-full resize-y rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
          {showImage ? (
            <input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Image URL (https://…)"
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-2 text-sm"
            />
          ) : null}
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setShowImage((value) => !value)} className="text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
              {showImage ? 'Remove image' : 'Add image'}
            </button>
            <Button type="submit" loading={posting} disabled={!content.trim()} className="gap-2">
              <Send size={15} aria-hidden="true" /> Post
            </Button>
          </div>
        </form>
      </Card>

      {/* Feed list */}
      {items.length ? (
        items.map((item) => (
          <Card key={item.id} className="rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Avatar item={item} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--color-text)]">
                      {item.author?.organisationSlug ? (
                        <Link href={`/companies/${item.author.organisationSlug}`} className="hover:text-[var(--color-primary)]">{item.author.name}</Link>
                      ) : item.author?.name}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">{item.author?.subtitle} · {formatWhen(item.createdAt)}</p>
                  </div>
                  {item.canDelete ? (
                    <button type="button" onClick={() => removePost(item)} aria-label="Delete post" className="shrink-0 rounded-full p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-danger)]">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--color-text)]">{item.content}</p>
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" /> : null}
              </div>
            </div>
          </Card>
        ))
      ) : (
        <Card className="rounded-2xl p-8 text-center">
          <p className="font-semibold text-[var(--color-text)]">Your feed is quiet for now</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {meta.followedCompanyCount ? 'Share your first update above.' : 'Follow companies to see their updates here, or share your first post above.'}
          </p>
          <Link href="/candidate/jobs" className="mt-4 inline-flex text-sm font-semibold text-[var(--color-primary)]">Discover companies →</Link>
        </Card>
      )}

      {meta.hasMore ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore} loading={loadingMore} className="gap-2">
            {loadingMore ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null} Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
