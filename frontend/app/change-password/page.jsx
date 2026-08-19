import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ChangePasswordForm } from '@/components/auth/change-password-form';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ChangePasswordPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth');
  }

  const params = await searchParams;
  const next = typeof params?.next === 'string' ? params.next : '';

  return <ChangePasswordForm role={user.role} required={user.mustChangePassword} next={next} />;
}
