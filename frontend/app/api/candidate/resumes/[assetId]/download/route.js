import { proxyBackendDownload } from '@/lib/proxy-download';

export async function GET(_request, { params }) {
  const { assetId } = await params;
  return proxyBackendDownload(`/candidate/resumes/${encodeURIComponent(assetId)}/download`);
}
