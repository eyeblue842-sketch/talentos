import { MessagesWorkspace } from '@/components/messaging/messages-workspace';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import {
  createMessageConversation,
  getConversationMessages,
  getMessageConversation,
  getMessageConversations,
} from '@/lib/api';

export default async function RecruiterMessagesPage({ searchParams }) {
  const params = await searchParams;
  let activeConversationId = typeof params?.conversation === 'string' ? params.conversation : '';

  if (!activeConversationId && typeof params?.user === 'string') {
    const conversation = await createMessageConversation(params.user);
    activeConversationId = conversation.id;
  }

  const [conversations, activeConversation, messages] = await Promise.all([
    getMessageConversations({ pageSize: 20 }),
    activeConversationId ? getMessageConversation(activeConversationId).catch(() => null) : Promise.resolve(null),
    activeConversationId
      ? getConversationMessages(activeConversationId, { limit: 25 }).catch(() => ({ items: [], meta: { nextCursor: null } }))
      : Promise.resolve({ items: [], meta: { nextCursor: null } }),
  ]);

  return (
    <WorkspaceShell brand="Careeriz Hire" items={recruiterNav}>
      <PageHeader
        eyebrow="Recruiter messages"
        title="Messages"
        description="Message connected candidates and professional contacts without exposing private contact details."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Messages' }]}
      />
      <MessagesWorkspace
        initialConversations={conversations.items}
        initialConversation={activeConversation}
        initialMessages={messages.items}
        initialMessagesMeta={messages.meta}
        activeConversationId={activeConversationId}
        basePath="/recruiter/messages"
      />
    </WorkspaceShell>
  );
}
