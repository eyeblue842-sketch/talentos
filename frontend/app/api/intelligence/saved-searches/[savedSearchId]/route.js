import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET(_request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { savedSearchId } = await params;
    const response = await proxyBackendJson(`/intelligence/saved-searches/${savedSearchId}`, { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { savedSearchId } = await params;
    const payload = await request.json();
    const response = await proxyBackendJson(`/intelligence/saved-searches/${savedSearchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, session.token);

    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
