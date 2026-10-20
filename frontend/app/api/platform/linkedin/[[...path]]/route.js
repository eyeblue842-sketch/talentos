import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

// Same-origin proxy for the platform-owner LinkedIn console. It only forwards
// to /platform/linkedin/*; authorization (super admin only) is enforced by the
// backend on every call - nothing here is trusted.
async function forward(request, { params }, method) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const { path = [] } = await params;
    const suffix = path.map(encodeURIComponent).join('/');
    const search = new URL(request.url).search;
    const init = { method };
    if (method !== 'GET') init.body = JSON.stringify(await request.json().catch(() => ({})));
    const response = await proxyBackendJson(`/platform/linkedin${suffix ? `/${suffix}` : ''}${search}`, init, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export const GET = (request, context) => forward(request, context, 'GET');
export const POST = (request, context) => forward(request, context, 'POST');
export const PUT = (request, context) => forward(request, context, 'PUT');
export const PATCH = (request, context) => forward(request, context, 'PATCH');
