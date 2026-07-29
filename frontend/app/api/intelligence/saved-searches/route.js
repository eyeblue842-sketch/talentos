import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const response = await proxyBackendJson('/intelligence/saved-searches', { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const payload = await request.json();
    const response = await proxyBackendJson('/intelligence/saved-searches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, session.token);

    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
