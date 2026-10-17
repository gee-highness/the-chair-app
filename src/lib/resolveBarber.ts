// src/lib/resolveBarber.ts
//
// Server-side lookup of one barber by (salon slug, barber slug), used by the
// barber app's manifest and metadata. Returns null for unknown or suspended
// salons so a barber's app never outlives their salon's access.
import { getDatabase } from '@/lib/mongodb';
import { resolveTenantBySlug } from '@/lib/resolveTenantBySlug';

export async function resolveBarber(tenantSlug: string, barberSlug: string) {
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return null;
  const db = await getDatabase();
  const barber = await db
    .collection('barbers')
    .findOne({ tenantId: tenant._id, slug: barberSlug }, { projection: { name: 1, slug: 1, imageUrl: 1, bio: 1, tags: 1 } });
  if (!barber) return null;
  const settings = await db.collection('siteSettings').findOne({ tenantId: tenant._id }, { projection: { title: 1, logoUrl: 1 } });
  return { tenant, barber, salonName: (settings?.title as string) || tenant.name };
}
