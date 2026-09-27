import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

// Lists the recruiter's own organisation jobs. Used by the "Associate to job"
// picker and the AI Match job selector to show open positions.
export async function GET(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const search = request.nextUrl.search || '';
    const response = await proxyBackendJson(`/jobs${search}`, { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
