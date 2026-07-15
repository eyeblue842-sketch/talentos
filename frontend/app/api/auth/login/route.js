import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestBackend, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST(request) {
  try {
    const payload = await request.json();
    const response = await requestBackend('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, response.data.token, sessionCookieOptions());

    return NextResponse.json({ success: true, data: response.data.session });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
