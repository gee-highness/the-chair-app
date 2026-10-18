import { barberManifest, manifestResponse } from '@/lib/manifests';

export async function GET(_req: Request, { params }: { params: Promise<{ tenantSlug: string; barberSlug: string }> }) {
  const { tenantSlug, barberSlug } = await params;
  return manifestResponse(await barberManifest(tenantSlug, barberSlug));
}
