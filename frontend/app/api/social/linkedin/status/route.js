import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const response = await proxyBackendJson('/social/linkedin/status', { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const response = await proxyBackendJson('/social/linkedin', { method: 'DELETE' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
