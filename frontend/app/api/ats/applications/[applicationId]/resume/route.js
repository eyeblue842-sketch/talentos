import { proxyBackendDownload } from '@/lib/proxy-download';

export async function GET(_request, { params }) {
  const { applicationId } = await params;
  return proxyBackendDownload(`/ats/applications/${encodeURIComponent(applicationId)}/resume`);
}
