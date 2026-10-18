import { notFound, redirect } from 'next/navigation';
import { getSessionToken, requestBackend } from '@/lib/auth';

// Access to the whole /platform console is decided by the backend, which is the
// single source of truth for "is this the configured super admin". We never
// gate on a client-supplied role/email. A non-super-admin's /platform/session
// call 403s, which we surface as a plain 404 (the console's existence is not
// revealed to other accounts).
export default async function PlatformLayout({ children }) {
  const token = await getSessionToken();
  if (!token) {
    redirect('/auth');
  }

  let authorized = false;
  try {
    await requestBackend('/platform/session', { method: 'GET' }, token);
    authorized = true;
  } catch {
    authorized = false;
  }

  if (!authorized) {
    notFound();
  }

  return children;
}
