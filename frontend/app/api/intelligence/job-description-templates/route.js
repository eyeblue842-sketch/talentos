import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET(_request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const response = await proxyBackendJson('/intelligence/job-description-templates', { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
