import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendFormData, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const search = request.nextUrl.search || '';
    const response = await proxyBackendJson(`/resume-imports${search}`, { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { response, body } = await proxyBackendFormData('/resume-imports', request, session.token);
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return mapApiRouteError(error);
  }
}

