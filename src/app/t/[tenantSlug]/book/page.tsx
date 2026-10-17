// src/app/t/[tenantSlug]/book/page.tsx
//
// Rebuilt for Part 2, Phase E: was free-text date/time inputs with no idea
// what was actually available (and no double-booking protection — see
// AUDIT_REPORT.md finding #9, fixed at the API level in
// /api/t/[tenantSlug]/book's GET+POST). Now a four-step flow: service →
// barber → real availability grid → contact details, so a customer can
// only pick a time this barber can actually take.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Ticket } from '@/components/ui/Ticket';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Stepper } from '@/components/Stepper';
import { useConfirmationSequence, SuccessStamp } from '@/components/SuccessStamp';
import { downloadCalendarFile } from '@/lib/calendar';
import { formatPrice, DEFAULT_CURRENCY } from '@/lib/currency';
import styles from './page.module.css';

interface Category {
  _id: string;
  name: string;
  imageUrl?: string;
}
interface Service {
  _id: string;
  name: string;
  duration: number;
  price: number;
  description?: string;
  imageUrl?: string;
  categoryId?: string;
  eligibleBarberIds?: string[];
}
interface Barber {
  _id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  bio?: string;
  tags?: string[];
}

const SLOT_GROUPS: Array<{ label: string; test: (hour: number) => boolean }> = [
  { label: 'Morning', test: (h) => h < 12 },
  { label: 'Afternoon', test: (h) => h >= 12 && h < 17 },
  { label: 'Evening', test: (h) => h >= 17 },
];

/** The next 14 days as quick-pick chips, starting today. */
function upcomingDays(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return isoDate(d);
  });
}

function dayParts(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    weekday: d.toLocaleDateString([], { weekday: 'short' }),
    day: d.getDate(),
    full: d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
  };
}

// Local calendar date (not UTC): near midnight, toISOString() would offer
// yesterday or tomorrow as "today".
function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookPage() {
  const { tenantSlug, barberSlug } = useParams<{ tenantSlug: string; barberSlug?: string }>();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [date, setDate] = useState(isoDate(new Date()));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [contact, setContact] = useState({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { stage, start: startConfirmation } = useConfirmationSequence();

  useEffect(() => {
    fetch(`/api/public/tenants/${tenantSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const fetchedServices: Service[] = data.services || [];
          const fetchedBarbers: Barber[] = data.barbers || [];
          setServices(fetchedServices);
          setBarbers(fetchedBarbers);
          setCategories(data.categories || []);
          setCurrency(data.tenant?.currency || DEFAULT_CURRENCY);
          // "Book with Marcus" on a barber's page arrives as ?barber=<id>,
          // and a service card on the salon's own page arrives as
          // ?service=<id> — either (or both) skips the step(s) that
          // choice already answers, same as picking it by hand would.
          const params = new URLSearchParams(window.location.search);
          const wantedBarber = params.get('barber');
          const wantedService = params.get('service');
          // Under /barbers/<slug>/book the barber comes from the path.
          const barberMatch = barberSlug
            ? fetchedBarbers.find((b) => b.slug === barberSlug)
            : wantedBarber ? fetchedBarbers.find((b) => b._id === wantedBarber) : undefined;
          const serviceMatch = wantedService ? fetchedServices.find((s) => s._id === wantedService) : undefined;
          // A URL can name both (e.g. a barber's own page linking straight
          // to "book with me"), but if that service restricts who can
          // perform it and this particular barber isn't on the list, only
          // honor the service and let the person actually pick from the
          // eligible barbers in step 2 rather than silently jumping to an
          // invalid pairing.
          const barberIsEligible =
            !barberMatch || !serviceMatch?.eligibleBarberIds?.length || serviceMatch.eligibleBarberIds.includes(barberMatch._id);
          if (barberMatch && barberIsEligible) setSelectedBarber(barberMatch);
          if (serviceMatch) {
            setSelectedService(serviceMatch);
            setStep(barberMatch && barberIsEligible ? 3 : 2);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [tenantSlug, barberSlug]);

  // A signed-in customer shouldn't have to retype who they are.
  useEffect(() => {
    fetch('/api/customer-auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me) setContact((c) => ({ ...c, name: c.name || me.name || '', email: c.email || me.email || '', phone: c.phone || me.phone || '' }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 3 || !selectedBarber || !selectedService || !date) return;
    setSlots(null);
    setSelectedSlot(null);
    fetch(`/api/t/${tenantSlug}/book?barberId=${selectedBarber._id}&serviceId=${selectedService._id}&date=${date}`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((data) => setSlots(data.slots || []));
  }, [step, selectedBarber, selectedService, date, tenantSlug]);

  const servicesByCategory = useMemo(() => {
    const grouped = new Map<string, Service[]>();
    for (const s of services) {
      const key = s.categoryId || 'uncategorized';
      grouped.set(key, [...(grouped.get(key) || []), s]);
    }
    return grouped;
  }, [services]);

  // Which team members can actually be picked for the currently-chosen
  // service — see Service.eligibleBarberIds. No restriction (undefined or
  // empty) means every barber is shown, same as before this existed.
  const eligibleBarbers = useMemo(() => {
    const restriction = selectedService?.eligibleBarberIds;
    if (!restriction || restriction.length === 0) return barbers;
    return barbers.filter((b) => restriction.includes(b._id));
  }, [barbers, selectedService]);

  const submitBooking = async () => {
    if (!selectedService || !selectedBarber || !selectedSlot) return;
    
    await startConfirmation(async () => {
      const res = await fetch(`/api/t/${tenantSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: contact.name,
          customerEmail: contact.email,
          customerPhone: contact.phone,
          serviceId: selectedService._id,
          barberId: selectedBarber._id,
          dateTime: selectedSlot,
          notes: contact.notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.show(data.message || 'Could not book that time', 'error');
        if (res.status === 409) {
          setStep(3);
          setSlots(null);
          setSelectedSlot(null);
        }
        throw new Error(data.message || 'Booking failed');
      }
      setConfirmed(true);
    });
  };

  if (loading) return <SkeletonLines count={6} />;

  if (confirmed) {
    return (
      <>
        {stage === 'success' && <SuccessStamp visible={true} />}
        <Ticket stamped className={styles.confirmTicket}>
        <p className={styles.confirmEyebrow}>Requested</p>
        <h1 className={styles.confirmHeading}>You're on the books</h1>
        <p className={styles.confirmDetail}>
          {selectedService?.name} with {selectedBarber?.name}
          <br />
          {selectedSlot && new Date(selectedSlot).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
        <p className={styles.confirmNote}>
          Your time is held and shows as <strong>Pending</strong> until the salon confirms it. Save this confirmation, and check <em>My appointments</em> for updates. If the salon has email set up, we'll also email {contact.email}.
        </p>
        <div className={styles.confirmActions}>
          {selectedSlot && selectedService && (
            <Button
              variant="secondary"
              onClick={() => downloadCalendarFile(`${selectedService.name} with ${selectedBarber?.name ?? ''}`, selectedSlot, selectedService.duration, tenantSlug)}
            >
              Add to calendar
            </Button>
          )}
          <Link href={`/t/${tenantSlug}/appointments`}>
            <Button variant="secondary">My appointments</Button>
          </Link>
          <Link href={`/t/${tenantSlug}`}>
            <Button variant="ghost">Back to salon</Button>
          </Link>
        </div>
      </Ticket>
      </>
    );
  }

  return (
    <div className={styles.wrap}>
      <Stepper 
        steps={['Service', 'Barber', 'Time', 'Details']}
        current={step}
        completed={step - 1}
      />

      {step > 1 && selectedService && (
        <div className={styles.summary} aria-label="Your booking so far">
          <button type="button" className={styles.summaryChip} onClick={() => setStep(1)}>
            <span className={styles.summaryLabel}>Service</span>
            {selectedService.name}
          </button>
          {selectedBarber && step > 2 && (
            <button type="button" className={styles.summaryChip} onClick={() => setStep(2)}>
              <span className={styles.summaryLabel}>Barber</span>
              {selectedBarber.name}
            </button>
          )}
          {selectedSlot && step > 3 && (
            <button type="button" className={styles.summaryChip} onClick={() => setStep(3)}>
              <span className={styles.summaryLabel}>Time</span>
              {new Date(selectedSlot).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </button>
          )}
          <span className={styles.summaryTotal}>
            {formatPrice(selectedService.price, currency)} · {selectedService.duration} min
          </span>
        </div>
      )}

      {step === 1 && (
        <section>
          <h1 className={styles.heading}>Choose a service</h1>
          {services.length === 0 ? (
            <EmptyState title="No services listed yet" />
          ) : (
            Array.from(servicesByCategory.entries()).map(([catId, list]) => {
              const category = categories.find((c) => c._id === catId);
              return (
                <div key={catId} className={styles.categoryGroup}>
                  <h2 className={styles.categoryTitle}>{category?.name || 'Other services'}</h2>
                  <div className={styles.serviceGrid}>
                    {list.map((s) => (
                      <button
                        key={s._id}
                        className={styles.serviceCard}
                        onClick={() => {
                          setSelectedService(s);
                          setStep(selectedBarber ? 3 : 2);
                        }}
                      >
                        {s.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.imageUrl} alt="" className={styles.serviceImage} />
                        )}
                        <p className={styles.serviceName}>{s.name}</p>
                        <p className={styles.serviceMeta}>
                          <span className={styles.mono}>{formatPrice(s.price, currency)}</span> · {s.duration} min
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {step === 2 && (
        <section>
          <button className={styles.back} onClick={() => setStep(1)}>
            ← Change service
          </button>
          <h1 className={styles.heading}>Choose a barber</h1>
          {eligibleBarbers.length === 0 ? (
            <EmptyState title="No one available for this service right now" description="Try a different service, or check back later." />
          ) : (
            <div className={styles.barberGrid}>
              {eligibleBarbers.map((b) => (
                <button
                  key={b._id}
                  className={styles.barberCard}
                  onClick={() => {
                    setSelectedBarber(b);
                    setStep(3);
                  }}
                >
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt="" className={styles.barberAvatar} />
                  ) : (
                    <div className={styles.barberAvatarPlaceholder}>{b.name.charAt(0)}</div>
                  )}
                  <p className={styles.barberName}>{b.name}</p>
                  {b.tags && b.tags.length > 0 && <p className={styles.barberTags}>{b.tags.join(' · ')}</p>}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 3 && selectedBarber && selectedService && (
        <section>
          <button className={styles.back} onClick={() => setStep(2)}>
            ← Change barber
          </button>
          <h1 className={styles.heading}>Pick a time</h1>
          <p className={styles.subheading}>
            {selectedService.name} with {selectedBarber.name}
          </p>

          <div className={styles.dayStrip} role="group" aria-label="Choose a day">
            {upcomingDays().map((iso) => {
              const { weekday, day, full } = dayParts(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  className={[styles.dayChip, date === iso ? styles.dayChipActive : ''].join(' ')}
                  aria-pressed={date === iso}
                  aria-label={full}
                  onClick={() => setDate(iso)}
                >
                  <span className={styles.dayWeekday}>{weekday}</span>
                  <span className={styles.dayNumber}>{day}</span>
                </button>
              );
            })}
          </div>
          <label className={styles.otherDate}>
            Another date
            <input type="date" className={styles.dateInput} value={date} min={isoDate(new Date())} onChange={(e) => setDate(e.target.value)} />
          </label>

          {slots === null ? (
            <SkeletonLines count={2} />
          ) : slots.length === 0 ? (
            <EmptyState title="No open times that day" description="Try another date." />
          ) : (
            SLOT_GROUPS.map((g) => {
              const inGroup = slots.filter((s) => g.test(new Date(s).getHours()));
              if (inGroup.length === 0) return null;
              return (
                <div key={g.label} className={styles.slotGroup}>
                  <h2 className={styles.slotGroupTitle}>{g.label}</h2>
                  <div className={styles.slotGrid}>
                    {inGroup.map((s) => (
                      <button
                        key={s}
                        className={[styles.slotButton, selectedSlot === s ? styles.slotButtonActive : ''].join(' ')}
                        aria-pressed={selectedSlot === s}
                        onClick={() => setSelectedSlot(s)}
                      >
                        {new Date(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          <Button fullWidth disabled={!selectedSlot} onClick={() => setStep(4)}>
            Continue
          </Button>
        </section>
      )}

      {step === 4 && (
        <section>
          <button className={styles.back} onClick={() => setStep(3)}>
            ← Change time
          </button>
          <h1 className={styles.heading}>Your details</h1>
          <Input label="Name" required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          <Input label="Email" required type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          <Input label="Phone" required type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          <Textarea label="Notes (optional)" value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />
          <p className={styles.reassure}>No payment now. You pay at the salon. The salon confirms your time.</p>
          <Button
            fullWidth
            loading={submitting}
            disabled={!contact.name || !contact.email || !contact.phone}
            onClick={submitBooking}
          >
            Confirm booking
          </Button>
        </section>
      )}
    </div>
  );
}
