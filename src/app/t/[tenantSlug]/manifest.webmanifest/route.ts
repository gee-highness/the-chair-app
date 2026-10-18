import { manifestResponse, salonManifest } from '@/lib/manifests';

export async function GET(_req: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return manifestResponse(await salonManifest(tenantSlug));
}
