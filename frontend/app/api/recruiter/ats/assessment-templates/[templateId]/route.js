import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function PATCH(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const { templateId } = await params;
    const body = await request.json();
    const response = await proxyBackendJson(`/ats/assessment-templates/${templateId}`, { method: 'PATCH', body: JSON.stringify(body) }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const { templateId } = await params;
    const response = await proxyBackendJson(`/ats/assessment-templates/${templateId}`, { method: 'DELETE' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
