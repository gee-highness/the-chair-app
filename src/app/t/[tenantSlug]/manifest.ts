// src/app/t/[tenantSlug]/manifest.ts
import { MetadataRoute } from 'next';
import { resolveTenantBySlug } from '@/lib/resolveTenantBySlug';
import { getDatabase } from '@/lib/mongodb';

export default async function manifest(
  { params }: { params: Promise<{ tenantSlug: string }> }
): Promise<MetadataRoute.Manifest> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);

  if (!tenant) {
    return {
      name: 'The Chair App',
      short_name: 'The Chair App',
      display: 'standalone',
      start_url: '/',
    };
  }

  const db = await getDatabase();
  const settings = await db.collection('siteSettings').findOne({ tenantId: tenant._id });

  return {
    name: settings?.title || tenant.name || 'The Chair App',
    short_name: (settings?.title || tenant.name || 'Salon').split(' ')[0],
    description: settings?.description || 'Book your appointment',
    start_url: `/t/${tenantSlug}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: tenant.branding?.primaryColor || '#2563eb',
    icons: settings?.logoUrl
      ? [{ src: settings.logoUrl, sizes: 'any', type: 'image/png' }]
      : [{ src: '/logo-192.png', sizes: '192x192', type: 'image/png' }],
  };
}
