import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestBackend, RESET_SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const resetSessionToken = cookieStore.get(RESET_SESSION_COOKIE)?.value;

  if (!resetSessionToken) {
    return NextResponse.json(
      { success: false, message: 'Password reset session is missing or expired.' },
      { status: 400 }
    );
  }

  try {
    const response = await requestBackend('/auth/password-reset/otp/resend', {
      method: 'POST',
      body: JSON.stringify({ token: resetSessionToken }),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
