// src/app/t/[tenantSlug]/barbers/[barberSlug]/manifest.ts
//
// Each barber is their own installable app: their name and photo on the home
// screen, opening straight to their profile and "Book with me". The scope is
// the barber's own path, so it is a distinct install from the salon's app.
import { MetadataRoute } from 'next';
import { resolveBarber } from '@/lib/resolveBarber';

export default async function manifest(
  { params }: { params: Promise<{ tenantSlug: string; barberSlug: string }> }
): Promise<MetadataRoute.Manifest> {
  const { tenantSlug, barberSlug } = await params;
  const found = await resolveBarber(tenantSlug, barberSlug);
  const base = `/t/${tenantSlug}/barbers/${barberSlug}`;

  if (!found) {
    return { name: 'The Chair App', short_name: 'The Chair', display: 'standalone', start_url: '/' };
  }

  const { tenant, barber, salonName } = found;
  const photo = (barber.imageUrl as string | undefined) || undefined;
  return {
    id: base,
    scope: `${base}/`,
    name: `${barber.name} · ${salonName}`,
    short_name: String(barber.name).split(' ')[0],
    description: (barber.bio as string | undefined) || `Book ${barber.name} at ${salonName}`,
    start_url: base,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: tenant.branding?.primaryColor || '#1f3b2e',
    icons: [
      ...(photo ? [{ src: photo, sizes: 'any', type: 'image/png', purpose: 'any' as const }] : []),
      { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcuts: [{ name: 'Book now', short_name: 'Book', url: `${base}/book` }],
  };
}
