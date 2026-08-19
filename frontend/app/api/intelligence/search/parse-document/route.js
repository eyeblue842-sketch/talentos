import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendFormData, requireApiSession } from '@/lib/api-route';

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { response, body } = await proxyBackendFormData('/intelligence/search/parse-document', request, session.token);
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return mapApiRouteError(error);
  }
}
