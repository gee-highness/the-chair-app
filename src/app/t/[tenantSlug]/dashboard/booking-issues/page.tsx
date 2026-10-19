// src/app/t/[tenantSlug]/dashboard/booking-issues/page.tsx
//
// Bookings customers tried to make that could not go ahead (the time clashed
// with another booking, or the barber isn't working then). Staff contact the
// customer, then mark the issue sorted.
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

interface BookingIssueRow {
  _id: string;
  status: 'open' | 'resolved';
  reason: 'overlap' | 'unavailable';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  requestedDateTime: string;
  barberName?: string;
  serviceName?: string;
  conflictDateTime?: string;
  notes?: string;
  createdAt: string;
  resolutionNote?: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function BookingIssuesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<BookingIssueRow[] | null>(null);
  const [view, setView] = useState<'open' | 'resolved'>('open');

  const load = () => {
    fetch('/api/booking-issues')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  };

  useEffect(load, []);

  const resolve = async (id: string) => {
    const res = await fetch('/api/booking-issues', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: id }),
    });
    if (res.ok) {
      toast.show('Marked as sorted', 'success');
      load();
    } else {
      toast.show('Could not update', 'error');
    }
  };

  const shown = (rows || []).filter((r) => r.status === view);
  const openCount = (rows || []).filter((r) => r.status === 'open').length;

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Booking issues</h1>
      </div>
      <p className={styles.meta}>
        Customers who tried to book but couldn&apos;t, because the time clashed with another booking or the barber isn&apos;t working then.
        Contact them to offer another time, then mark it sorted.
      </p>

      <div className={styles.tabs}>
        <Button size="sm" variant={view === 'open' ? 'primary' : 'ghost'} onClick={() => setView('open')}>
          Needs attention ({openCount})
        </Button>
        <Button size="sm" variant={view === 'resolved' ? 'primary' : 'ghost'} onClick={() => setView('resolved')}>
          Sorted
        </Button>
      </div>

      {rows === null ? (
        <SkeletonLines count={3} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={view === 'open' ? 'Nothing needs attention' : 'Nothing sorted yet'}
          description={view === 'open' ? 'Blocked bookings will show up here.' : 'Issues you mark as sorted are kept here.'}
        />
      ) : (
        <div className={styles.list}>
          {shown.map((r) => (
            <div key={r._id} className={styles.row}>
              <div className={styles.body}>
                <p className={styles.name}>
                  {r.customerName} · {fmt(r.requestedDateTime)}
                </p>
                <p className={styles.meta}>
                  {r.serviceName || 'Service'} with {r.barberName || 'barber'} ·{' '}
                  <a href={`tel:${r.customerPhone}`}>{r.customerPhone}</a> · <a href={`mailto:${r.customerEmail}`}>{r.customerEmail}</a>
                </p>
                <span className={styles.reason}>
                  {r.reason === 'overlap'
                    ? `Clashes with another booking${r.conflictDateTime ? ` at ${fmt(r.conflictDateTime)}` : ''}`
                    : 'Outside working hours'}
                </span>
                {r.notes && <p className={styles.meta}>Customer note: {r.notes}</p>}
                {r.resolutionNote && <p className={styles.meta}>Outcome: {r.resolutionNote}</p>}
              </div>
              {r.status === 'open' && (
                <div className={styles.actions}>
                  <Button size="sm" onClick={() => resolve(r._id)}>
                    Mark sorted
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
