import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const response = await proxyBackendJson(`/resume-imports/${batchId}/retry-failed`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

