import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl } from '@/lib/auth';
import { extractProxyFileName, mapApiRouteError, requireApiSession } from '@/lib/api-route';

export async function GET(_request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;

    const { batchId, itemId } = await params;
    const response = await fetch(`${getBackendApiBaseUrl()}/resume-imports/${batchId}/items/${itemId}/download`, {
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
          message: payload?.message || 'Unable to download the original resume.',
          details: payload?.details,
        },
        { status: response.status },
      );
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${extractProxyFileName(response.headers, `${itemId}.bin`).replace(/"/g, '')}"`,
      },
    });
  } catch (error) {
    return mapApiRouteError(error);
  }
}

