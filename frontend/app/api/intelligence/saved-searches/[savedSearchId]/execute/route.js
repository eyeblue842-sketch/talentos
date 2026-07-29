import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(_request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { savedSearchId } = await params;
    const response = await proxyBackendJson(`/intelligence/saved-searches/${savedSearchId}/execute`, {
      method: 'POST',
    }, session.token);

    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
