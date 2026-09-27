import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST() {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const response = await proxyBackendJson('/social/linkedin/connect', { method: 'POST', body: '{}' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
