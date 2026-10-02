import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function DELETE(request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const { postId } = await params;
    const response = await proxyBackendJson(`/feed/posts/${postId}`, { method: 'DELETE' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
