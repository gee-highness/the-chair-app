// A salon's link preview: its name, tagline and brand colour.
import { getDatabase } from '@/lib/mongodb';
import { resolveTenantBySlug } from '@/lib/resolveTenantBySlug';
import { OG_SIZE, ogCard } from '@/lib/ogCard';

export const alt = 'Book an appointment';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return ogCard({ eyebrow: 'The Chair App', title: 'Salons and barbershops' });
  const db = await getDatabase();
  const settings = await db.collection('siteSettings').findOne({ tenantId: tenant._id }, { projection: { title: 1, description: 1, logoUrl: 1 } });
  return ogCard({
    eyebrow: 'Salon',
    title: (settings?.title as string) || tenant.name,
    subtitle: settings?.description as string | undefined,
    color: tenant.branding?.primaryColor,
    photo: settings?.logoUrl as string | undefined,
  });
}
