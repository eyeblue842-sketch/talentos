import { getBackendApiBaseUrl } from '@/lib/auth';
import { mapApiRouteError, requireApiSession } from '@/lib/api-route';

// Streams the merged offer letter (.docx, or the pdfkit PDF fallback) from the
// backend to the recruiter's browser.
export async function GET(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const { offerId } = await params;
    const upstream = await fetch(`${getBackendApiBaseUrl()}/offers/${offerId}/document`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': upstream.headers.get('content-disposition') || 'attachment; filename="offer-letter"',
      },
    });
  } catch (error) {
    return mapApiRouteError(error);
  }
}
