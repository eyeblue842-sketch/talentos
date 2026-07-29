import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { jobId } = await params;
    const payload = await request.json().catch(() => ({}));
    const response = await proxyBackendJson(`/intelligence/jobs/${jobId}/ranking/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, session.token);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    return mapApiRouteError(error);
  }
}
