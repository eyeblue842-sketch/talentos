import { ResumeBuilderStudio } from '@/components/sections/resume-builder-studio';

export default async function PublicResumeBuilderEntry({ searchParams }) {
  const params = await searchParams;
  const initialContext = {
    candidateName: params?.candidateName,
    candidateEmail: params?.candidateEmail,
    jobTitle: params?.jobTitle,
    company: params?.company,
    source: params?.source,
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <ResumeBuilderStudio initialContext={initialContext} />
    </main>
  );
}
