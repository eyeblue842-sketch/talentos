import { NextResponse } from 'next/server';
import { requestBackend } from '@/lib/auth';

export async function POST(request) {
  try {
    const payload = await request.json();
    const response = await requestBackend('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        role: payload.role || 'CANDIDATE',
      }),
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
