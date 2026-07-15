import { requireUser } from '@/lib/auth';

export default async function RecruiterLayout({ children }) {
  await requireUser('RECRUITER');
  return children;
}
