// src/components/dashboard/PageHint.tsx
//
// A one-line "what is this page for" tip at the top of each dashboard page,
// dismissible per page and remembered on this device. Servo's staff screens
// carry the same kind of inline help.
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PageHint.module.css';

const HINTS: Record<string, string> = {
  '': 'Your day at a glance. Pending bookings need a tap to confirm, and the Appointments tab shows a badge when new ones arrive.',
  appointments: 'Pick a day, then change a booking’s status from its menu. Mark visits Completed when done: that is when loyalty points are earned.',
  waitlist: 'Walk-ins queue here with no fixed time. Tap Seat now when a chair frees up.',
  services: 'Customers book from this menu. Add a price and duration for each service, and restrict a service to specific barbers if needed.',
  barbers: 'Each barber needs working hours, or customers will see no times. Use App link to share a barber’s own booking app.',
  staff: 'Adding someone creates a welcome PDF with a temporary password. They must choose their own at first sign-in.',
  customers: 'Everyone who has booked. Search by name, email or phone, or export the list to a spreadsheet.',
  reviews: 'Reviews come only from completed visits. Hide one that breaks the rules; customers will no longer see it.',
  analytics: 'Bookings and busy days over time. Use it to decide when to staff up.',
  posts: 'Share photos of your work. They appear on your page and in the Stylist feed for people who follow you.',
  settings: 'Your salon’s name, colours, logo, prices and location. Customers see these straight away after you save.',
};

export function PageHint({ section, base }: { section: string; base: string }) {
  const hint = HINTS[section];
  const key = `chair_hint_${section || 'overview'}`;
  const [hidden, setHidden] = useState(true); // hidden until we know it was not dismissed

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === '1');
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (!hint || hidden) return null;

  return (
    <aside className={styles.hint} aria-label="Tip for this page">
      <p className={styles.text}>
        {hint} <Link href={`${base}/guide`}>Read the guide</Link>
      </p>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Hide this tip"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, '1');
          } catch {
            // Private mode: it just comes back next visit.
          }
        }}
      >
        ×
      </button>
    </aside>
  );
}

