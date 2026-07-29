import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const payload = await request.json();
    const response = await proxyBackendJson('/intelligence/search/suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, session.token);

    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
