import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const body = await request.json();
    const response = await proxyBackendJson('/ats/invites', { method: 'POST', body: JSON.stringify(body) }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
