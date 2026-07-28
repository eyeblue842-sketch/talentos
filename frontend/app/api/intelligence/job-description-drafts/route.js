import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const payload = await request.json().catch(() => ({}));
    const response = await proxyBackendJson('/intelligence/job-description-drafts', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }, session.token);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return mapApiRouteError(error);
  }
}
