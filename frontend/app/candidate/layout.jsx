import { requireUser } from '@/lib/auth';

export default async function CandidateLayout({ children }) {
  await requireUser('CANDIDATE');
  return children;
}
