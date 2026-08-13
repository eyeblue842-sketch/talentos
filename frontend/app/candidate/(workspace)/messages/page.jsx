import { MessagesWorkspace } from '@/components/messaging/messages-workspace';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import {
  createMessageConversation,
  getConversationMessages,
  getMessageConversation,
  getMessageConversations,
} from '@/lib/api';

export default async function CandidateMessagesPage({ searchParams }) {
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
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Candidate messages"
        title="Messages"
        description="Continue professional conversations with connected recruiters and peers."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Messages' }]}
      />
      <MessagesWorkspace
        initialConversations={conversations.items}
        initialConversation={activeConversation}
        initialMessages={messages.items}
        initialMessagesMeta={messages.meta}
        activeConversationId={activeConversationId}
        basePath="/candidate/messages"
      />
    </WorkspaceShell>
  );
}
