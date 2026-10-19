// src/lib/bookingIssues.ts
//
// When a customer's booking can't go ahead because of a clash with another
// booking (or the barber isn't working then), the customer is told to pick
// another time, and the salon gets a record here so staff can contact them.
import { Db, ObjectId } from 'mongodb';
import { Appointment, BookingIssue } from './types';
import { toBookedRange } from './availability';
import { notifyBookingIssue } from './push';

const DEFAULT_DURATION_MIN = 30;

/** The first live (pending/confirmed) booking of this barber that overlaps [start, start + duration), if any. */
export async function findOverlappingAppointment(
  db: Db,
  p: { tenantId: ObjectId; barberId: ObjectId; start: Date; durationMin: number; excludeId?: ObjectId }
): Promise<Appointment | null> {
  const dayStart = new Date(p.start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(p.start);
  dayEnd.setHours(23, 59, 59, 999);

  const sameDay = await db
    .collection<Appointment>('appointments')
    .find({
      tenantId: p.tenantId,
      barberId: p.barberId,
      status: { $in: ['pending', 'confirmed'] },
      dateTime: { $gte: dayStart, $lte: dayEnd },
    })
    .toArray();
  const others = sameDay.filter((a) => !(p.excludeId && a._id?.equals(p.excludeId)));
  if (others.length === 0) return null;

  const ids = [...new Set(others.map((a) => a.serviceId.toString()))].map((id) => new ObjectId(id));
  const services = await db.collection('services').find({ _id: { $in: ids } }, { projection: { duration: 1 } }).toArray();
  const durationById = new Map(services.map((s) => [s._id.toString(), s.duration]));

  const wanted = toBookedRange(p.start, p.durationMin);
  return (
    others.find((a) => {
      const r = toBookedRange(new Date(a.dateTime), durationById.get(a.serviceId.toString()) || DEFAULT_DURATION_MIN);
      return wanted.start < r.end && wanted.end > r.start;
    }) || null
  );
}

/**
 * Records a blocked booking (once per customer, barber and time while it is
 * still open) and alerts staff. Never throws: a failure here must not change
 * what the customer is told.
 */
export async function recordBookingIssue(
  db: Db,
  p: {
    tenantId: ObjectId;
    tenantSlug: string;
    barberId: ObjectId;
    serviceId: ObjectId;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    requestedDateTime: Date;
    durationMin: number;
    notes?: string;
  }
): Promise<void> {
  try {
    const conflict = await findOverlappingAppointment(db, {
      tenantId: p.tenantId,
      barberId: p.barberId,
      start: p.requestedDateTime,
      durationMin: p.durationMin,
    });

    const duplicate = await db.collection<BookingIssue>('bookingIssues').findOne({
      tenantId: p.tenantId,
      barberId: p.barberId,
      customerEmail: p.customerEmail,
      requestedDateTime: p.requestedDateTime,
      status: 'open',
    });
    if (duplicate) return;

    const issue: BookingIssue = {
      tenantId: p.tenantId,
      barberId: p.barberId,
      serviceId: p.serviceId,
      customerName: p.customerName,
      customerEmail: p.customerEmail,
      customerPhone: p.customerPhone,
      requestedDateTime: p.requestedDateTime,
      reason: conflict ? 'overlap' : 'unavailable',
      ...(conflict?._id ? { conflictAppointmentId: conflict._id } : {}),
      ...(p.notes ? { notes: p.notes } : {}),
      status: 'open',
      createdAt: new Date(),
    };
    await db.collection<BookingIssue>('bookingIssues').insertOne(issue);

    await notifyBookingIssue(db, {
      tenantId: p.tenantId,
      tenantSlug: p.tenantSlug,
      barberId: p.barberId,
      customerName: p.customerName,
      dateTime: p.requestedDateTime,
    });
  } catch (err) {
    console.error('recordBookingIssue failed:', err);
  }
}
