import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function GET(_request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { jobId, candidateId } = await params;
    const response = await proxyBackendJson(`/intelligence/jobs/${jobId}/candidates/${candidateId}/match/status`, { method: 'GET' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
