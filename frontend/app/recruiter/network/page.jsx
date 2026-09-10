import { redirect } from 'next/navigation';

export default async function RecruiterNetworkPage({ searchParams }) {
  const params = await searchParams;
  redirect(`/recruiter/home?tab=connections&section=discover${params?.q ? `&q=${encodeURIComponent(params.q)}` : ''}`);
}
