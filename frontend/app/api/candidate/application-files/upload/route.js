import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

export async function POST(request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const formData = await request.formData();
  const response = await fetch(`${API_BASE}/candidate/application-files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
