// A barber's link preview: their photo, name and salon.
import { OG_SIZE, ogCard } from '@/lib/ogCard';
import { resolveBarber } from '@/lib/resolveBarber';

export const alt = 'Book with this barber';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ tenantSlug: string; barberSlug: string }> }) {
  const { tenantSlug, barberSlug } = await params;
  const found = await resolveBarber(tenantSlug, barberSlug);
  if (!found) return ogCard({ eyebrow: 'The Chair App', title: 'Salons and barbershops' });
  const { tenant, barber, salonName } = found;
  const tags = Array.isArray(barber.tags) ? (barber.tags as string[]).slice(0, 3).join(' · ') : '';
  return ogCard({
    eyebrow: salonName,
    title: String(barber.name),
    subtitle: tags || (barber.bio as string | undefined),
    color: tenant.branding?.primaryColor,
    footer: `Book ${String(barber.name).split(' ')[0]} on The Chair App`,
    photo: barber.imageUrl as string | undefined,
  });
}
