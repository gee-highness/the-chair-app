// src/hooks/useBookingIssueCount.ts
//
// How many blocked bookings still need someone to contact the customer.
// Polled while the dashboard is open and visible, like usePendingCount.
'use client';
import { useEffect, useState } from 'react';

const POLL_MS = 60_000;

export function useBookingIssueCount(enabled = true): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || typeof fetch !== 'function') return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/booking-issues?status=open');
        if (!res.ok) return;
        const rows = await res.json();
        if (alive && Array.isArray(rows)) setCount(rows.length);
      } catch {
        // Offline or signed out: keep the last count.
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', load);
    };
  }, [enabled]);

  return count;
}
