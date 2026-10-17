// src/app/t/[tenantSlug]/barbers/[barberSlug]/layout.tsx
//
// Server layout so the barber's profile has real metadata (home-screen name,
// share card) even though the page itself is a client component.
import type { Metadata } from 'next';
import { resolveBarber } from '@/lib/resolveBarber';

export async function generateMetadata(
  { params }: { params: Promise<{ tenantSlug: string; barberSlug: string }> }
): Promise<Metadata> {
  const { tenantSlug, barberSlug } = await params;
  const found = await resolveBarber(tenantSlug, barberSlug);
  if (!found) return {};
  const { barber, salonName } = found;
  const title = `${barber.name} · ${salonName}`;
  const description = (barber.bio as string | undefined) || `Book an appointment with ${barber.name} at ${salonName}.`;
  return {
    title,
    description,
    appleWebApp: { capable: true, title: String(barber.name).split(' ')[0], statusBarStyle: 'default' },
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(barber.imageUrl ? { images: [barber.imageUrl as string] } : {}),
    },
  };
}

export default function BarberLayout({ children }: { children: React.ReactNode }) {
  return children;
}
