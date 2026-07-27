import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { batchId } = await params;
    const search = request.nextUrl.search || '';
    const response = await proxyBackendJson(`/resume-imports/${batchId}/items${search}`, { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

