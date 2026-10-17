// src/hooks/usePendingCount.ts
//
// How many bookings are waiting for the salon to confirm. Polled while the
// dashboard is open and visible, so new online bookings show up as a badge
// on the Appointments tab (and in the browser tab title) without a reload.
'use client';
import { useEffect, useState } from 'react';

const POLL_MS = 60_000;

export function usePendingCount(enabled = true): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || typeof fetch !== 'function') return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/appointments');
        if (!res.ok) return;
        const rows = await res.json();
        if (alive && Array.isArray(rows)) {
          const now = Date.now();
          setCount(rows.filter((a: { status: string; dateTime: string }) => a.status === 'pending' && new Date(a.dateTime).getTime() > now - 86_400_000).length);
        }
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
