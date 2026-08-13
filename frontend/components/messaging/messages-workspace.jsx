'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function timeLabel(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

async function fetchJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({ success: false, message: 'Request failed.' }));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Request failed.');
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

export function MessagesWorkspace({
  initialConversations,
  initialConversation,
  initialMessages,
  initialMessagesMeta,
  activeConversationId,
  basePath,
}) {
  const [conversations, setConversations] = useState(initialConversations || []);
  const [conversation, setConversation] = useState(initialConversation || null);
  const [messages, setMessages] = useState(initialMessages || []);
  const [messagesMeta, setMessagesMeta] = useState(initialMessagesMeta || { nextCursor: null });
  const [composer, setComposer] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function clearUnreadState(conversationId) {
    setConversation((current) => (current?.id === conversationId ? { ...current, unreadCount: 0 } : current));
    setConversations((current) => current.map((item) => (
      item.id === conversationId ? { ...item, unreadCount: 0 } : item
    )));
  }

  useEffect(() => {
    setConversations(initialConversations || []);
    setConversation(initialConversation || null);
    setMessages(initialMessages || []);
    setMessagesMeta(initialMessagesMeta || { nextCursor: null });
  }, [initialConversations, initialConversation, initialMessages, initialMessagesMeta, activeConversationId]);

  useEffect(() => {
    if (!conversation?.id) return undefined;

    const interval = setInterval(async () => {
      try {
        const [conversationPayload, messagesPayload, conversationsPayload] = await Promise.all([
          fetchJson(`/api/messages/conversations/${conversation.id}`),
          fetchJson(`/api/messages/conversations/${conversation.id}/messages?limit=25`),
          fetchJson('/api/messages/conversations'),
        ]);
        setConversation(conversationPayload.data);
        setMessages(messagesPayload.data || []);
        setMessagesMeta(messagesPayload.meta || { nextCursor: null });
        setConversations(conversationsPayload.data || []);
      } catch {
        // Keep the existing UI stable during polling failures.
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id || !messages.length || !conversation.unreadCount) return;
    const lastReadMessageId = messages[messages.length - 1]?.id;
    fetchJson(`/api/messages/conversations/${conversation.id}/read`, {
      method: 'POST',
      body: JSON.stringify(lastReadMessageId ? { lastReadMessageId } : {}),
    }).then(() => {
      clearUnreadState(conversation.id);
    }).catch(() => null);
  }, [conversation?.id, conversation?.unreadCount, messages]);

  async function openConversation(conversationId) {
    setLoading(true);
    setError('');
    try {
      const [conversationPayload, messagesPayload] = await Promise.all([
        fetchJson(`/api/messages/conversations/${conversationId}`),
        fetchJson(`/api/messages/conversations/${conversationId}/messages?limit=25`),
      ]);
      setConversation(conversationPayload.data);
      setMessages(messagesPayload.data || []);
      setMessagesMeta(messagesPayload.meta || { nextCursor: null });
      window.history.replaceState(null, '', `${basePath}?conversation=${conversationId}`);
    } catch (caught) {
      setError(caught.message || 'Unable to open conversation.');
    } finally {
      setLoading(false);
    }
  }

  async function loadOlderMessages() {
    if (!conversation?.id || !messagesMeta?.nextCursor || loading) return;
    setLoading(true);
    try {
      const payload = await fetchJson(`/api/messages/conversations/${conversation.id}/messages?limit=25&cursor=${encodeURIComponent(messagesMeta.nextCursor)}`);
      setMessages((current) => [...(payload.data || []), ...current]);
      setMessagesMeta(payload.meta || { nextCursor: null });
    } catch (caught) {
      setError(caught.message || 'Unable to load older messages.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!conversation?.id || pending) return;
    setPending(true);
    setError('');
    try {
      const formData = new FormData();
      if (composer.trim()) formData.set('content', composer.trim());
      if (attachment) formData.set('attachment', attachment);
      await fetchJson(`/api/messages/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: formData,
      });
      setComposer('');
      setAttachment(null);
      await openConversation(conversation.id);
    } catch (caught) {
      setError(caught.message || 'Unable to send message.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <Card className="rounded-[32px] p-5">
        <div className="space-y-3" aria-label="Conversations">
          {conversations.length ? conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`conversation-row-${item.id}`}
              onClick={() => openConversation(item.id)}
              className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left ${item.id === conversation?.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] bg-white'}`}
            >
              <Avatar name={item.participant.fullName} src={item.participant.profilePhoto} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{item.participant.fullName}</p>
                  {item.unreadCount ? (
                    <span
                      aria-label={`${item.unreadCount} unread messages`}
                      data-testid={`conversation-unread-badge-${item.id}`}
                      className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-white"
                    >
                      {item.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-[var(--color-text-muted)]">
                  {item.participant.designation || item.participant.headline || 'Careeriz professional'}
                  {item.participant.company ? ` • ${item.participant.company}` : ''}
                </p>
                <p className="mt-2 truncate text-sm text-[var(--color-text-secondary)]">{item.lastMessagePreview || 'No messages yet.'}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{timeLabel(item.lastMessageAt || item.createdAt)}</p>
              </div>
            </button>
          )) : (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
              <p className="font-semibold text-[var(--color-text)]">No conversations yet</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Use Network to message connected professionals.</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-[32px] p-0">
        {conversation?.participant ? (
          <div className="flex min-h-[42rem] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-6 py-5">
              <div className="flex items-center gap-3">
                <Avatar name={conversation.participant.fullName} src={conversation.participant.profilePhoto} size="lg" />
                <div>
                  <p className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">{conversation.participant.fullName}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {conversation.participant.designation || conversation.participant.headline || 'Careeriz professional'}
                    {conversation.participant.company ? ` • ${conversation.participant.company}` : ''}
                  </p>
                </div>
              </div>
              <Link href={conversation.participant.profilePath} className="text-sm font-semibold text-[var(--color-primary)]">View profile</Link>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5" role="log" aria-label="Conversation messages">
              {messagesMeta?.nextCursor ? (
                <div className="flex justify-center">
                  <Button type="button" variant="outline" onClick={loadOlderMessages} disabled={loading}>Load older</Button>
                </div>
              ) : null}
              {messages.length ? messages.map((message) => (
                <div key={message.id} className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[42rem] rounded-[24px] px-4 py-3 text-sm shadow-[var(--shadow-sm)] ${message.isOwn ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-muted)] text-[var(--color-text)]'}`}>
                    {message.content ? <p className="whitespace-pre-wrap leading-6">{message.content}</p> : null}
                    {message.attachment ? (
                      <a href={`/api/messages/attachments/${message.id}`} className={`mt-3 inline-flex items-center gap-2 font-semibold ${message.isOwn ? 'text-white' : 'text-[var(--color-primary)]'}`}>
                        <Paperclip size={14} aria-hidden="true" />
                        {message.attachment.filename}
                      </a>
                    ) : null}
                    <p className={`mt-2 text-xs ${message.isOwn ? 'text-white/75' : 'text-[var(--color-text-muted)]'}`}>{timeLabel(message.createdAt)}</p>
                  </div>
                </div>
              )) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-[var(--color-text-muted)]">No messages yet. Start the conversation.</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t border-[var(--color-border)] px-6 py-5">
              {!conversation.canSend ? (
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  Messaging is currently unavailable. The connection may have been removed or blocked.
                </div>
              ) : (
                <div className="grid gap-3">
                  <textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder="Write a professional message"
                    rows={4}
                    className="w-full rounded-3xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    aria-label="Message composer"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]">
                      <Paperclip size={16} aria-hidden="true" />
                      Attachment
                      <input type="file" className="sr-only" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                    </label>
                    <div className="flex items-center gap-3">
                      {attachment ? <span className="max-w-52 truncate text-xs text-[var(--color-text-muted)]">{attachment.name}</span> : null}
                      <Button type="submit" disabled={pending || (!composer.trim() && !attachment)} leadingIcon={Send}>
                        {pending ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
            </form>
          </div>
        ) : (
          <div className="flex min-h-[42rem] items-center justify-center px-6 py-10 text-center">
            <div>
              <p className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">Open a conversation</p>
              <p className="mt-3 max-w-md text-sm leading-7 text-[var(--color-text-muted)]">
                Start from My Network or an eligible professional profile to message connected candidates and recruiters.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
