// src/app/t/[tenantSlug]/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Ticket } from '@/components/ui/Ticket';
import { Badge, statusTone } from '@/components/ui/Badge';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from './page.module.css';

interface Appointment {
  _id: string;
  dateTime: string;
  status: string;
  source?: string;
}

export default function DashboardOverview() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [counts, setCounts] = useState<{ services: number; barbers: number; customers: number } | null>(null);

  useEffect(() => {
    fetch('/api/appointments')
      .then((r) => (r.ok ? r.json() : []))
      .then(setAppointments)
      .catch(() => setAppointments([]));

    Promise.all([
      fetch('/api/services').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/barbers').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/customers').then((r) => (r.ok ? r.json() : [])),
    ]).then(([services, barbers, customers]) => {
      setCounts({ services: services.length, barbers: barbers.length, customers: customers.length });
    });
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysAppointments = (appointments || []).filter((a) => {
    const d = new Date(a.dateTime);
    return d >= today && d < tomorrow && a.status !== 'cancelled';
  });
  const waitlistCount = (appointments || []).filter((a) => a.status === 'waitlist').length;

  return (
    <div>
      <h1 className={styles.heading}>Overview</h1>

      <div className={styles.statRow}>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{counts ? counts.services : <SkeletonLines count={1} />}</p>
          <p className={styles.statLabel}>Services</p>
        </Ticket>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{counts ? counts.barbers : <SkeletonLines count={1} />}</p>
          <p className={styles.statLabel}>Barbers</p>
        </Ticket>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{counts ? counts.customers : <SkeletonLines count={1} />}</p>
          <p className={styles.statLabel}>Customers</p>
        </Ticket>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{appointments ? waitlistCount : <SkeletonLines count={1} />}</p>
          <p className={styles.statLabel}>On waitlist</p>
        </Ticket>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Today's tickets</h2>
          <Link href={`/t/${tenantSlug}/dashboard/appointments`} className={styles.link}>
            View all appointments
          </Link>
        </div>

        {appointments === null ? (
          <SkeletonLines count={4} />
        ) : todaysAppointments.length === 0 ? (
          <EmptyState title="Nothing on the books today" description="New online bookings and walk-ins will show up here as they come in." />
        ) : (
          <div className={styles.list}>
            {todaysAppointments
              .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
              .map((a) => (
                <div key={a._id} className={styles.listRow}>
                  <span className={styles.time}>
                    {new Date(a.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <Badge tone={statusTone(a.status)} />
                  {a.source === 'walk-in' && <span className={styles.walkIn}>walk-in</span>}
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
