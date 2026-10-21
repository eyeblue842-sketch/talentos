import { proxyBackendDownload } from '@/lib/proxy-download';

export async function GET(request, { params }) {
  const { assetId } = await params;
  return proxyBackendDownload(`/ats/files/${encodeURIComponent(assetId)}`, { search: new URL(request.url).search });
}
