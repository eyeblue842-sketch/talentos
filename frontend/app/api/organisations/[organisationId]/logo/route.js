import { getBackendApiBaseUrl } from '@/lib/auth';

// Same-origin proxy so <img src="/api/organisations/:id/logo"> loads without any
// public-base/CORS setup. Streams the backend's public logo route through.
export async function GET(request, { params }) {
  const { organisationId } = await params;
  const search = new URL(request.url).search;
  const backendResponse = await fetch(
    `${getBackendApiBaseUrl()}/organisations/${encodeURIComponent(organisationId)}/logo${search}`,
    { cache: 'no-store' },
  );

  if (!backendResponse.ok || !backendResponse.body) {
    return new Response(null, { status: backendResponse.status || 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', backendResponse.headers.get('content-type') || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(backendResponse.body, { status: 200, headers });
}
