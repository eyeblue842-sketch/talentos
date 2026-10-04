import { redirect } from 'next/navigation';

// Messages now live as a tab on the candidate Network page. Preserve any deep
// links (e.g. ?conversation=… or ?user=…) by forwarding them to that tab.
export default async function CandidateMessagesRedirect({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: 'messages' });
  if (typeof params?.conversation === 'string') query.set('conversation', params.conversation);
  if (typeof params?.user === 'string') query.set('user', params.user);
  redirect(`/candidate/network?${query.toString()}`);
}
