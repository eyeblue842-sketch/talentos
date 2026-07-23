import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl, getSessionToken } from '@/lib/auth';

export async function POST(request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const formData = await request.formData();
  const response = await fetch(`${getBackendApiBaseUrl()}/candidate/resumes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
