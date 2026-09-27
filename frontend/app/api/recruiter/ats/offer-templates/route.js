import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const response = await proxyBackendJson('/ats/offer-templates', { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const body = await request.json();
    const response = await proxyBackendJson('/ats/offer-templates', { method: 'POST', body: JSON.stringify(body) }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
