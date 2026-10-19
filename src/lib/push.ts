// src/lib/push.ts
//
// Web Push for staff: "New booking" alerts that arrive even when the
// dashboard is closed. Entirely optional: with no VAPID keys configured it is
// a silent no-op and the UI hides the switch. Generate keys once with
//   npx web-push generate-vapid-keys
// and set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and (optionally) VAPID_SUBJECT.
import webpush from 'web-push';
import { Db, ObjectId } from 'mongodb';

export interface PushSubscriptionDoc {
  _id?: ObjectId;
  tenantId: ObjectId;
  subjectId: ObjectId;
  role: string;
  barberId?: ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
}

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:${process.env.SUPPORT_EMAIL || 'geehyness22@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

/** Accepts only the shape a browser's PushSubscription.toJSON() produces. */
export function parseSubscription(body: any): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  try {
    if (new URL(endpoint).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { endpoint, keys: { p256dh, auth } };
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Sends to each subscription; drops ones the push service says are gone (404/410). Returns how many were delivered. */
export async function sendPush(db: Db, subs: PushSubscriptionDoc[], payload: PushPayload): Promise<number> {
  if (!isPushConfigured() || subs.length === 0) return 0;
  configure();
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        delivered += 1;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db.collection('pushSubscriptions').deleteOne({ endpoint: s.endpoint });
        }
      }
    })
  );
  return delivered;
}

/**
 * A customer booked online: alert the salon's owners and receptionists and
 * the barber who was booked (never other barbers). Best-effort.
 */
export async function notifyNewBooking(
  db: Db,
  p: { tenantId: ObjectId; tenantSlug: string; barberId: ObjectId; customerName: string; serviceName?: string; dateTime: Date }
): Promise<number> {
  if (!isPushConfigured()) return 0;
  try {
    const subs = await db
      .collection<PushSubscriptionDoc>('pushSubscriptions')
      .find({ tenantId: p.tenantId, $or: [{ role: { $in: ['admin', 'receptionist'] } }, { barberId: p.barberId }] })
      .toArray();
    const when = p.dateTime.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return await sendPush(db, subs, {
      title: 'New booking',
      body: `${p.customerName}${p.serviceName ? ` · ${p.serviceName}` : ''} · ${when}`,
      url: `/t/${p.tenantSlug}/dashboard/appointments`,
      tag: 'new-booking',
    });
  } catch (err) {
    console.error('push notify failed:', err);
    return 0;
  }
}

/**
 * A customer's booking could not go ahead (clashed with another booking or
 * fell outside working hours): alert owners and receptionists and the barber
 * it was for, so someone can contact the customer. Best-effort.
 */
export async function notifyBookingIssue(
  db: Db,
  p: { tenantId: ObjectId; tenantSlug: string; barberId: ObjectId; customerName: string; dateTime: Date }
): Promise<number> {
  if (!isPushConfigured()) return 0;
  try {
    const subs = await db
      .collection<PushSubscriptionDoc>('pushSubscriptions')
      .find({ tenantId: p.tenantId, $or: [{ role: { $in: ['admin', 'receptionist'] } }, { barberId: p.barberId }] })
      .toArray();
    const when = p.dateTime.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return await sendPush(db, subs, {
      title: 'Booking needs attention',
      body: `${p.customerName} couldn't be booked for ${when}. Contact them to sort it out.`,
      url: `/t/${p.tenantSlug}/dashboard/booking-issues`,
      tag: 'booking-issue',
    });
  } catch (err) {
    console.error('push notify failed:', err);
    return 0;
  }
}
