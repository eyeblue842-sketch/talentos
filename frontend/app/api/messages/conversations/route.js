import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const { search } = new URL(request.url);
    const response = await requestBackend(`/messages/conversations${search}`, { method: 'GET' }, token);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: error.statusCode || 500 });
  }
}

export async function POST(request) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const payload = await request.json();
    const response = await requestBackend('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: error.statusCode || 500 });
  }
}
