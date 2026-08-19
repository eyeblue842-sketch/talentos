import { requireUser } from '@/lib/auth';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CandidateLayout({ children }) {
  await requireUser(['CANDIDATE', 'CANDIDATE_ADMIN']);
  return children;
}
