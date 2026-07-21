import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const response = await requestBackend('/candidate/data-export', { method: 'GET' }, token);
    return new NextResponse(JSON.stringify(response.data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="careeriz-candidate-export.json"',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    }, { status: error.statusCode || 500 });
  }
}
