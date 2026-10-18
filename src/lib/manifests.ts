// src/lib/manifests.ts
//
// The four installable apps on this origin: Discovery (root), the platform
// Admin console, a salon, and a single barber. Each has its own `id`, `scope`
// and `start_url`, so installing one never installs another.
//
// Served by explicit route handlers (app/**/manifest.webmanifest/route.ts)
// and linked from each section's layout via `metadata.manifest`. Next.js's
// `manifest.ts` file convention only works at the app root: nested ones are
// never linked and 404, which made every page install the Discovery app.
import type { MetadataRoute } from 'next';
import { resolveBarber } from '@/lib/resolveBarber';
import { resolveTenantBySlug } from '@/lib/resolveTenantBySlug';
import { getDatabase } from '@/lib/mongodb';

type Manifest = MetadataRoute.Manifest;

export const MANIFEST_HEADERS = {
  'Content-Type': 'application/manifest+json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
};

export function manifestResponse(manifest: Manifest): Response {
  return new Response(JSON.stringify(manifest), { headers: MANIFEST_HEADERS });
}

export function rootManifest(): Manifest {
  return {
    id: '/',
    scope: '/',
    name: 'The Chair App - Discover Salons',
    short_name: 'The Chair App',
    description: 'Discover and book appointments at top salons and barbershops',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f3ec',
    theme_color: '#0f2236',
    icons: [
      { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/logo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

export function adminManifest(): Manifest {
  return {
    // `id` + `scope` make this a distinct install from the discovery site it
    // shares an origin with (see src/lib/pwaScope.ts for the matching worker scope).
    id: '/admin',
    scope: '/admin/',
    name: 'The Chair App - Admin',
    short_name: 'Admin',
    description: 'Manage your salons and barbers',
    start_url: '/admin',
    display: 'standalone',
    background_color: '#f7f3ec',
    theme_color: '#0f2236',
    icons: [
      { src: '/admin-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/admin-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/admin-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

export async function salonManifest(tenantSlug: string): Promise<Manifest> {
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return rootManifest();

  const db = await getDatabase();
  const settings = await db.collection('siteSettings').findOne({ tenantId: tenant._id });
  const name = settings?.title || tenant.name || 'The Chair App';

  return {
    // All tenants share one origin (no per-tenant subdomain, see DEPLOY.md), so
    // `id` + `scope` are what keep one salon's install apart from every other's.
    id: `/t/${tenantSlug}`,
    scope: `/t/${tenantSlug}/`,
    name,
    short_name: name.split(' ')[0],
    description: settings?.description || 'Book your appointment',
    start_url: `/t/${tenantSlug}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: tenant.branding?.primaryColor || '#2563eb',
    icons: [
      ...(settings?.logoUrl ? [{ src: settings.logoUrl as string, sizes: 'any', purpose: 'any' as const }] : []),
      { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

/** A barber is their own app: their name and photo, opening on their profile. */
export async function barberManifest(tenantSlug: string, barberSlug: string): Promise<Manifest> {
  const found = await resolveBarber(tenantSlug, barberSlug);
  if (!found) return rootManifest();

  const { tenant, barber, salonName } = found;
  const base = `/t/${tenantSlug}/barbers/${barberSlug}`;
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
    theme_color: tenant.branding?.primaryColor || '#0f2236',
    // The photo has no `type`: uploads are not always PNG, and a wrong
    // type makes the browser drop the icon.
    icons: [
      ...(photo ? [{ src: photo, sizes: 'any', purpose: 'any' as const }] : []),
      { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcuts: [{ name: 'Book now', short_name: 'Book', url: `${base}/book` }],
  };
}
