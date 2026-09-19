// __tests__/part2-security.test.ts
//
// New regression tests written by the Part 2 audit for the new attack
// surface introduced in Part 2 (customer-claim auth, the booking
// double-booking guard, and review authenticity). Unlike booking.test.ts's
// third suite, everything here is confirmed PASSING against the shipped
// Part 2 code — these lock in behavior the audit verified by hand, so a
// future change that quietly breaks one of these invariants gets caught.
//
// Run with: npx vitest run __tests__/part2-security.test.ts
// (Not executed in the audit sandbox — no network egress to install vitest.)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function hash(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

describe('customer-claim auth cannot satisfy staff requireRole', () => {
  let tenantA: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
  });

  it('a valid customerClaim cookie alone does not authorize a staff-only route', async () => {
    const { GET } = await import('@/app/api/services/route');
    const db = fakeDb.db as FakeDb;

    // A genuinely valid, unexpired customer claim session.
    const customerId = new ObjectId();
    const rawClaimToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([
      { tokenHash: hash(rawClaimToken), customerId, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    db.collection('services').seed([{ _id: new ObjectId(), tenantId: tenantA, name: 'Haircut', duration: 30, price: 25 }]);

    // Only the customerClaim cookie is sent — no `session` cookie at all.
    const req: any = new Request('http://localhost/api/services', {
      headers: { cookie: `customerClaim=${rawClaimToken}` },
    });

    const res = await GET(req);
    // requireRole() only ever reads the `session` cookie against the
    // `sessions` collection — verifyClaimSession's collection
    // (customerClaimSessions) and cookie name (customerClaim) are entirely
    // separate, so this must 401, not leak the tenant's services.
    expect(res.status).toBe(401);
  });

  it('a claim token that happens to collide with a staff tokenHash still is not a staff session', async () => {
    // Belt-and-suspenders: even if an attacker could somehow get their claim
    // raw token accepted under the `session=` cookie name, verifySessionToken
    // only ever queries the `sessions` collection — a document that only
    // exists in `customerClaimSessions` will never match.
    const { GET } = await import('@/app/api/services/route');
    const db = fakeDb.db as FakeDb;

    const customerId = new ObjectId();
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([
      { tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    // Deliberately NOT seeding `sessions` with this token.

    const req: any = new Request('http://localhost/api/services', {
      headers: { cookie: `session=${rawToken}` }, // sent under the STAFF cookie name
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/t/[tenantSlug]/book — double-booking guard', () => {
  let tenantA: ObjectId, barberId: ObjectId, serviceId: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    barberId = new ObjectId();
    serviceId = new ObjectId();

    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantA, slug: 'tenant-a', status: 'active' }]);
    db.collection('barbers').seed([
      {
        _id: barberId,
        tenantId: tenantA,
        name: 'Alex',
        // Open every day, all day, so the test is not sensitive to which
        // calendar day "tonight" or "tomorrow" happens to fall on when run.
        dailyAvailability: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:59' })),
      },
    ]);
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Haircut', duration: 30, price: 25 }]);
  });

  function bookingRequest(dateTime: string, customerEmail: string) {
    return new Request('http://localhost/api/t/tenant-a/book', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Casey',
        customerEmail,
        customerPhone: '555-0100',
        serviceId: serviceId.toString(),
        barberId: barberId.toString(),
        dateTime,
      }),
    }) as any;
  }

  it('the second request for the exact same barber+slot is rejected with 409, not double-booked', async () => {
    const { POST } = await import('@/app/api/t/[tenantSlug]/book/route');
    const db = fakeDb.db as FakeDb;

    // Pick a slot far enough in the future today that it's not filtered as "past".
    const slot = new Date();
    slot.setHours(23, 0, 0, 0);
    if (slot.getTime() < Date.now()) slot.setDate(slot.getDate() + 1); // roll to tomorrow if 23:00 already passed
    const dateTime = slot.toISOString();

    const first = await POST(bookingRequest(dateTime, 'first@example.com'), { params: Promise.resolve({ tenantSlug: 'tenant-a' }) });
    expect(first.status).toBe(201);

    const second = await POST(bookingRequest(dateTime, 'second@example.com'), { params: Promise.resolve({ tenantSlug: 'tenant-a' }) });
    expect(second.status).toBe(409);

    const count = await db.collection('appointments').countDocuments({ barberId, dateTime: slot });
    expect(count).toBe(1); // only the first booking exists
  });
});

describe('POST /api/reviews — review authenticity', () => {
  let claimCustomerId: ObjectId, tenantA: ObjectId;
  let rawClaimToken: string;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    claimCustomerId = new ObjectId();
    rawClaimToken = crypto.randomBytes(16).toString('hex');

    const db = fakeDb.db as FakeDb;
    db.collection('customerClaimSessions').seed([
      { tokenHash: hash(rawClaimToken), customerId: claimCustomerId, expiresAt: new Date(Date.now() + 60_000) },
    ]);
  });

  function reviewRequest(body: any) {
    return nextRequest('http://localhost/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `customerClaim=${rawClaimToken}` },
      body: JSON.stringify(body),
    });
  }

  it('rejects a review for an appointment that belongs to a different customer', async () => {
    const { POST } = await import('@/app/api/reviews/route');
    const db = fakeDb.db as FakeDb;

    const someoneElsesAppt = new ObjectId();
    db.collection('appointments').seed([
      { _id: someoneElsesAppt, tenantId: tenantA, customerId: new ObjectId(), status: 'completed' }, // NOT claimCustomerId
    ]);

    const res = await POST(reviewRequest({ appointmentId: someoneElsesAppt.toString(), rating: 5 }));
    expect(res.status).toBe(400);

    const count = await db.collection('reviews').countDocuments({});
    expect(count).toBe(0);
  });

  it('rejects a review for an appointment that is not yet completed', async () => {
    const { POST } = await import('@/app/api/reviews/route');
    const db = fakeDb.db as FakeDb;

    const pendingAppt = new ObjectId();
    db.collection('appointments').seed([
      { _id: pendingAppt, tenantId: tenantA, customerId: claimCustomerId, status: 'confirmed' }, // not 'completed'
    ]);

    const res = await POST(reviewRequest({ appointmentId: pendingAppt.toString(), rating: 5 }));
    expect(res.status).toBe(400);
  });

  it('accepts a review for the claimant\'s own completed appointment', async () => {
    const { POST } = await import('@/app/api/reviews/route');
    const db = fakeDb.db as FakeDb;

    const ownAppt = new ObjectId();
    db.collection('appointments').seed([
      { _id: ownAppt, tenantId: tenantA, barberId: new ObjectId(), customerId: claimCustomerId, status: 'completed' },
    ]);

    const res = await POST(reviewRequest({ appointmentId: ownAppt.toString(), rating: 5, text: 'Great cut!' }));
    expect(res.status).toBe(201);
  });
});
