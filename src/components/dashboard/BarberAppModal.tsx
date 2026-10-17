// src/components/dashboard/BarberAppModal.tsx
//
// Hands a salon owner everything needed to put one barber's own app in
// customers' hands: the link, a QR code to print or show, and how it installs.
'use client';
import { ShareLinkModal } from './ShareLinkModal';

export function BarberAppModal({
  open,
  onClose,
  barberName,
  barberSlug,
}: {
  open: boolean;
  onClose: () => void;
  barberName: string;
  barberSlug: string;
}) {
  // The dashboard lives at /t/<salon>/dashboard/..., so the salon slug is in the URL.
  const salon = typeof window !== 'undefined' ? window.location.pathname.match(/^\/t\/([^/]+)/)?.[1] : undefined;
  return (
    <ShareLinkModal
      open={open}
      onClose={onClose}
      title={`${barberName}'s app`}
      path={salon && barberSlug ? `/t/${salon}/barbers/${barberSlug}` : ''}
      help={`Customers who open this link can book ${barberName.split(' ')[0]} directly and install it on their phone as its own app.`}
      fileName={`${barberSlug}-qr.png`}
    />
  );
}
