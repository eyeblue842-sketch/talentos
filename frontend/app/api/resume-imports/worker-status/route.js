import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const response = await proxyBackendJson('/resume-imports/worker-status', { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
