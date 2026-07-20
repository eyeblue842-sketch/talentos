import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function POST(request, context) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const { poolId } = await context.params;
    const body = await request.json();
    const response = await requestBackend(`/resumes/talent-pools/${poolId}/candidates`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 },
    );
  }
}
