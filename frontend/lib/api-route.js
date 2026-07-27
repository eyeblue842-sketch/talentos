import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl, getSessionToken, requestBackend } from '@/lib/auth';

export async function requireApiSession() {
  const token = await getSessionToken();
  if (!token) {
    return {
      ok: false,
      token: null,
      response: NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 }),
    };
  }

  return { ok: true, token };
}

export function mapApiRouteError(error) {
  return NextResponse.json(
    {
      success: false,
      message: error?.message || 'Request failed.',
      details: error?.details,
      code: error?.code || null,
    },
    { status: error?.statusCode || error?.status || 500 },
  );
}

export async function proxyBackendJson(path, init = {}, token) {
  return requestBackend(path, init, token);
}

export async function proxyBackendFormData(path, request, token) {
  const formData = await request.formData();
  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
}

export function extractProxyFileName(headers, fallback) {
  const disposition = headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

