import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl } from '@/lib/auth';
import { extractProxyFileName, mapApiRouteError, requireApiSession } from '@/lib/api-route';

export async function GET(_request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { batchId } = await params;
    const response = await fetch(`${getBackendApiBaseUrl()}/resume-imports/${batchId}/failure-report`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return NextResponse.json(
        {
          success: false,
          message: payload?.message || 'Unable to download the failure report.',
          details: payload?.details,
        },
        { status: response.status },
      );
    }

    const body = await response.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${extractProxyFileName(response.headers, `resume-import-${batchId}-failures.csv`).replace(/"/g, '')}"`,
      },
    });
  } catch (error) {
    return mapApiRouteError(error);
  }
}

