import { redirect } from 'next/navigation';

export default async function RecruiterMessagesPage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: 'connections', section: 'messages' });
  for (const key of ['conversation', 'user']) if (typeof params?.[key] === 'string') query.set(key, params[key]);
  redirect(`/recruiter/home?${query.toString()}`);
}
