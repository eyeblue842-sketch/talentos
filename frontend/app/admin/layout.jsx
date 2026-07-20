import { requireUser } from '@/lib/auth';

export default async function AdminLayout({ children }) {
  await requireUser(['ADMIN', 'SUPER_ADMIN']);
  return children;
}
