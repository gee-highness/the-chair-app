// src/app/t/[tenantSlug]/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Ticket } from '@/components/ui/Ticket';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Skeleton, SkeletonLines } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PushToggle } from '@/components/dashboard/PushToggle';
import { useCurrency } from '@/hooks/useCurrency';
import { useRole } from '@/hooks/useRole';
import { formatPrice } from '@/lib/currency';
import styles from './page.module.css';

interface Appointment {
  _id: string;
  dateTime: string;
  status: string;
  source?: string;
  barberName?: string;
  serviceName?: string;
  servicePrice?: number;
  customerName?: string;
  customerPhone?: string;
}

export default function DashboardOverview() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const currency = useCurrency();
  // Set after mount: the server's clock and time zone are not the viewer's.
  const [greeting, setGreeting] = useState('Hello');
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
  }, []);
  const role = useRole();
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
  const pending = (appointments || []).filter((a) => a.status === 'pending' && new Date(a.dateTime).getTime() > Date.now() - 86_400_000);
  const upcomingToday = todaysAppointments
    .filter((a) => new Date(a.dateTime).getTime() >= Date.now() - 15 * 60_000 && a.status !== 'completed')
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  const next = upcomingToday[0];
  const expectedToday = todaysAppointments.reduce((sum, a) => sum + (a.servicePrice || 0), 0);


  return (
    <div>
      <h1 className={styles.heading}>Overview</h1>
      <p className={styles.greeting}>
        {greeting}. {appointments === null ? 'Loading your day…' : todaysAppointments.length === 0 ? 'Nothing booked yet today.' : `You have ${todaysAppointments.length} ${todaysAppointments.length === 1 ? 'visit' : 'visits'} today${role === 'barber' ? '' : `, about ${formatPrice(expectedToday, currency)} in services`}.`}
      </p>

      {appointments !== null && pending.length > 0 && (
        <Link href={`/t/${tenantSlug}/dashboard/appointments`} className={styles.attention}>
          <strong>{pending.length} {pending.length === 1 ? 'booking is' : 'bookings are'} waiting for you</strong>
          <span>Confirm so customers know they are in →</span>
        </Link>
      )}

      {next && (
        <div className={styles.nextUp} aria-label="Next appointment">
          <span className={styles.nextLabel}>Next up</span>
          <strong className={styles.nextTime}>
            {new Date(next.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </strong>
          <span className={styles.nextDetail}>
            {next.customerName || 'Customer'} · {next.serviceName || 'Service'}
            {role !== 'barber' && next.barberName ? ` · with ${next.barberName}` : ''}
          </span>
          {next.customerPhone && (
            <a className={styles.callLink} href={`tel:${next.customerPhone.replace(/\s+/g, '')}`}>
              Call {next.customerPhone}
            </a>
          )}
        </div>
      )}

      <div className={styles.quickActions} role="group" aria-label="Quick actions">
        <Link href={`/t/${tenantSlug}/dashboard/appointments`} className={styles.quickAction}>Appointments</Link>
        {role !== 'barber' && <Link href={`/t/${tenantSlug}/dashboard/waitlist`} className={styles.quickAction}>Add walk-in</Link>}
        {role === 'barber' && <Link href={`/t/${tenantSlug}/dashboard/posts`} className={styles.quickAction}>Post your work</Link>}
        <Link href={`/t/${tenantSlug}/dashboard/guide`} className={styles.quickAction}>Guide</Link>
      </div>

      <PushToggle />

      <div className={styles.statRow}>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{counts ? counts.services : <Skeleton width="2ch" height="1em" />}</p>
          <p className={styles.statLabel}>Services</p>
        </Ticket>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{counts ? counts.barbers : <Skeleton width="2ch" height="1em" />}</p>
          <p className={styles.statLabel}>Barbers</p>
        </Ticket>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{counts ? counts.customers : <Skeleton width="2ch" height="1em" />}</p>
          <p className={styles.statLabel}>Customers</p>
        </Ticket>
        <Ticket className={styles.stat}>
          <p className={styles.statValue}>{appointments ? waitlistCount : <Skeleton width="2ch" height="1em" />}</p>
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
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{a.customerName || 'Customer'}</span>
                    {(a.serviceName || a.barberName) && (
                      <span className={styles.rowMeta}>
                        {a.serviceName}
                        {role !== 'barber' && a.barberName ? ` · ${a.barberName}` : ''}
                      </span>
                    )}
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
