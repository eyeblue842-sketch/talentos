import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function POST(request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const payload = await request.json();

  try {
    const response = await requestBackend('/candidate/recent-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
      details: error.details,
    }, { status: error.statusCode || 500 });
  }
}
