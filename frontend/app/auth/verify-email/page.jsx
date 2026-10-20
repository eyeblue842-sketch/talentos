import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ResendVerificationForm } from '@/components/auth/resend-verification-form';

export const metadata = { title: 'Verify email | Careeriz' };

// Landing page for the emailed verification link: tells the user clearly whether
// the address is now verified, and what to do next either way.
export default async function VerifyEmailPage({ searchParams }) {
  const params = (await searchParams) || {};
  const verified = params.status === 'success';
  const employer = params.audience === 'employer';
  const signInHref = employer ? '/hire' : '/auth/candidate/login';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <Card className="w-full text-center">
        {verified ? (
          <>
            <CheckCircle2 className="mx-auto text-emerald-600" size={56} aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-semibold text-[var(--color-text)]">Your email has been verified</h1>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Thanks for confirming your email address. You can now sign in to your {employer ? 'employer workspace' : 'account'}.
            </p>
            <div className="mt-6 flex justify-center">
              <Button href={signInHref}>Continue to sign in</Button>
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto text-red-600" size={56} aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-semibold text-[var(--color-text)]">We couldn&apos;t verify your email</h1>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              This verification link is invalid, has expired, or was already used. If you have already verified your email, you can simply sign in.
              Otherwise, enter your email below and we&apos;ll send you a new link.
            </p>
            <div className="mt-6 text-left">
              <ResendVerificationForm />
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button href="/hire" variant="outline">Employer sign in</Button>
              <Button href="/auth/candidate/login" variant="outline">Candidate sign in</Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
