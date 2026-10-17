// src/app/t/[tenantSlug]/appointments/page.tsx
//
// Full rebuild for Part 2, Phase G. This closes the gap Part 1's audit
// flagged as still open: the page used to call the STAFF-only
// GET /api/appointments (401s for a real customer, and separately
// rendered unpopulated ObjectId references even if it hadn't). It now
// calls the claim-gated GET /api/t/[tenantSlug]/my-appointments — signed
// in via the lightweight email-code claim, not a full account — and shows
// loyalty points plus a review prompt on completed visits.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Ticket } from '@/components/ui/Ticket';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { downloadCalendarFile } from '@/lib/calendar';
import { CustomerSignInModal } from '@/components/CustomerSignInModal';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import styles from './page.module.css';

interface Appointment {
  _id: string;
  dateTime: string;
  status: string;
  notes?: string;
  barberName?: string;
  serviceName?: string;
  servicePrice?: number;
  serviceDuration?: number;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className={styles.stars} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={styles.star}
          onClick={() => onChange(n)}
          style={{ opacity: n <= value ? 1 : 0.3 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const confirm = useConfirm();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { customer, signInOpen, setSignInOpen, requireSignIn, onSignedIn } = useCustomerAuth();

  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [reviewModal, setReviewModal] = useState<{ open: boolean; appointment?: Appointment }>({ open: false });
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const load = () => {
    fetch(`/api/t/${tenantSlug}/my-appointments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAppointments(data.appointments);
          setLoyaltyPoints(data.loyaltyPoints);
        } else {
          setAppointments([]);
        }
      });
  };

  useEffect(() => {
    if (customer) load();
    else if (customer === null) setAppointments([]);
  }, [customer, tenantSlug]);

  const submitReview = async () => {
    if (!reviewModal.appointment) return;
    setSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: reviewModal.appointment._id, rating, text: reviewText }),
      });
      if (res.ok) {
        toast.show('Thanks for the review!', 'success');
        setReviewedIds((prev) => new Set(prev).add(reviewModal.appointment!._id));
        setReviewModal({ open: false });
        setRating(5);
        setReviewText('');
      } else {
        const data = await res.json();
        toast.show(data.message || 'Could not submit review', 'error');
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const cancelBooking = async (apt: Appointment) => {
    const when = new Date(apt.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const ok = await confirm({
      title: 'Cancel this booking?',
      message: `${apt.serviceName ?? 'Your appointment'} with ${apt.barberName ?? 'your barber'} on ${when}. The time goes back to other customers.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    setCancellingId(apt._id);
    try {
      const res = await fetch(`/api/t/${tenantSlug}/my-appointments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: apt._id, action: 'cancel' }),
      });
      if (res.ok) {
        toast.show('Booking cancelled', 'success');
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.show(data.message || 'Could not cancel. Please contact the salon.', 'error');
      }
    } finally {
      setCancellingId(null);
    }
  };

  if (customer === undefined) return <SkeletonLines count={4} />;

  if (!customer) {
    return (
      <>
        <EmptyState
          title="Sign in to see your appointments"
          description="We'll send a one-time code to the email you used when booking — no password needed."
          action={<Button onClick={() => setSignInOpen(true)}>Sign in</Button>}
        />
        <CustomerSignInModal open={signInOpen} onClose={() => setSignInOpen(false)} onSignedIn={onSignedIn} />
      </>
    );
  }

  const upcoming = (appointments || []).filter((a) => new Date(a.dateTime) > new Date() && a.status !== 'cancelled');
  const past = (appointments || []).filter((a) => new Date(a.dateTime) <= new Date() || a.status === 'cancelled');

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>My appointments</h1>
        <Ticket className={styles.loyaltyTicket}>
          <span className={styles.loyaltyValue}>{loyaltyPoints}</span>
          <span className={styles.loyaltyLabel}>loyalty points</span>
        </Ticket>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Upcoming</h2>
        {appointments === null ? (
          <SkeletonLines count={2} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Nothing upcoming"
            description="Ready for your next visit?"
            action={<Link href={`/t/${tenantSlug}/book`}><Button size="sm">Book now</Button></Link>}
          />
        ) : (
          <div className={styles.list}>
            {upcoming.map((apt) => {
              const d = new Date(apt.dateTime);
              return (
                <div key={apt._id} className={styles.row}>
                  <div className={styles.dateBlock} aria-hidden="true">
                    <span className={styles.dateMonth}>{d.toLocaleDateString([], { month: 'short' })}</span>
                    <span className={styles.dateDay}>{d.getDate()}</span>
                  </div>
                  <div className={styles.rowBody}>
                    <p className={styles.service}>{apt.serviceName}</p>
                    <p className={styles.meta}>
                      with {apt.barberName} · {d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={() => downloadCalendarFile(`${apt.serviceName ?? 'Appointment'} with ${apt.barberName ?? ''}`, apt.dateTime, apt.serviceDuration || 30, tenantSlug)}
                      >
                        Add to calendar
                      </button>
                      <button
                        type="button"
                        className={`${styles.textButton} ${styles.dangerText}`}
                        disabled={cancellingId === apt._id}
                        onClick={() => cancelBooking(apt)}
                      >
                        {cancellingId === apt._id ? 'Cancelling…' : 'Cancel booking'}
                      </button>
                    </div>
                  </div>
                  <Badge tone={statusTone(apt.status)} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Past</h2>
        {appointments === null ? (
          <SkeletonLines count={2} />
        ) : past.length === 0 ? (
          <EmptyState title="No past appointments yet" />
        ) : (
          <div className={styles.list}>
            {past.map((apt) => (
              <div key={apt._id} className={styles.row}>
                <div className={styles.rowBody}>
                  <p className={styles.service}>{apt.serviceName}</p>
                  <p className={styles.meta}>
                    with {apt.barberName} · {new Date(apt.dateTime).toLocaleDateString()}
                  </p>
                </div>
                {apt.status === 'completed' && !reviewedIds.has(apt._id) ? (
                  <Button size="sm" variant="secondary" onClick={() => setReviewModal({ open: true, appointment: apt })}>
                    Leave a review
                  </Button>
                ) : (
                  <Badge tone={statusTone(apt.status)} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={reviewModal.open} onClose={() => setReviewModal({ open: false })} title="Leave a review">
        <StarPicker value={rating} onChange={setRating} />
        <Textarea label="Comments (optional)" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
        <Button fullWidth loading={submittingReview} onClick={submitReview}>
          Submit review
        </Button>
      </Modal>
    </div>
  );
}
