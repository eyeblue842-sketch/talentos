import { NextResponse } from 'next/server';
import { mapApiRouteError, proxyBackendJson, requireApiSession } from '@/lib/api-route';

export async function POST(_request, { params }) {
  try {
    const session = await requireApiSession();
    if (!session.ok) return session.response;
    const { postId } = await params;
    const response = await proxyBackendJson(`/social/linkedin/posts/${encodeURIComponent(postId)}/retry`, { method: 'POST' }, session.token);
    return NextResponse.json(response);
  } catch (error) {
    return mapApiRouteError(error);
  }
}
