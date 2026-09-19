// __tests__/booking.test.ts
//
// 1. Confirms POST /api/t/[tenantSlug]/book validates that the chosen
//    service/barber actually belong to the resolved tenant (PROGRESS.md's
//    Phase 3 claim — confirmed correct).
// 2. UPDATE (Part 2 audit): the staff-facing POST /api/appointments used to
//    have no equivalent ownership check (Part 1 audit finding). PROGRESS2.md
//    Phase C claims this was fixed to mirror the booking route, and the
//    Part 2 audit (AUDIT_REPORT2.md) confirmed that fix is correctly in
//    place (src/app/api/appointments/route.ts:76-86). This test's
//    assertion (expect 400) is therefore CONFIRMED PASSING against the
//    Part 2 codebase, not a known-failing regression test anymore — kept
//    here as the permanent regression guard for this fix. (Comment
//    corrected by the Part 2 audit; the test body itself did not need to
//    change.)
//
// Run with: npx vitest run __tests__/booking.test.ts (not executed here — see note in tenant-scoping.test.ts)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

describe('POST /api/t/[tenantSlug]/book — public booking', () => {
  let tenantA: ObjectId, tenantB: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    tenantB = new ObjectId();
    (fakeDb.db as FakeDb).collection('tenants').seed([
      { _id: tenantA, slug: 'tenant-a', status: 'active' },
      { _id: tenantB, slug: 'tenant-b', status: 'active' },
    ]);
  });

  it('rejects booking a service that belongs to a different tenant than the URL slug', async () => {
    const { POST } = await import('@/app/api/t/[tenantSlug]/book/route');
    const db = fakeDb.db as FakeDb;

    const tenantBServiceId = new ObjectId();
    const tenantABarberId = new ObjectId();
    db.collection('services').seed([{ _id: tenantBServiceId, tenantId: tenantB, name: 'Tenant B Service' }]);
    db.collection('barbers').seed([{ _id: tenantABarberId, tenantId: tenantA, name: 'Tenant A Barber' }]);

    const req: any = new Request('http://localhost/api/t/tenant-a/book', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Casey',
        customerEmail: 'casey@example.com',
        customerPhone: '555-0100',
        serviceId: tenantBServiceId.toString(), // belongs to tenant B
        barberId: tenantABarberId.toString(),
        dateTime: new Date().toISOString(),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ tenantSlug: 'tenant-a' }) });
    expect(res.status).toBe(400);

    const created = await db.collection('appointments').countDocuments({});
    expect(created).toBe(0); // nothing booked
  });

  it('accepts a booking when service and barber both belong to the resolved tenant', async () => {
    const { POST } = await import('@/app/api/t/[tenantSlug]/book/route');
    const db = fakeDb.db as FakeDb;

    const serviceId = new ObjectId();
    const barberId = new ObjectId();
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Haircut' }]);
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex' }]);

    const req: any = new Request('http://localhost/api/t/tenant-a/book', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Casey',
        customerEmail: 'casey@example.com',
        customerPhone: '555-0100',
        serviceId: serviceId.toString(),
        barberId: barberId.toString(),
        dateTime: new Date().toISOString(),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ tenantSlug: 'tenant-a' }) });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/appointments — staff-facing create (Part 1 audit finding, fixed in Part 2)', () => {
  let tenantA: ObjectId, tenantB: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    tenantB = new ObjectId();
  });

  function sessionCookieFor(db: FakeDb, tenantId: ObjectId) {
    const rawToken = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    db.collection('sessions').seed([
      { tokenHash, subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    return rawToken;
  }

  it('CONFIRMED FIXED: rejects an appointment whose barberId belongs to a different tenant', async () => {
    const { POST } = await import('@/app/api/appointments/route');
    const db = fakeDb.db as FakeDb;

    const foreignBarberId = new ObjectId();
    const foreignServiceId = new ObjectId();
    const foreignCustomerId = new ObjectId();
    db.collection('barbers').seed([{ _id: foreignBarberId, tenantId: tenantB, name: 'Tenant B Barber' }]);
    db.collection('services').seed([{ _id: foreignServiceId, tenantId: tenantB, name: 'Tenant B Service' }]);
    db.collection('customers').seed([{ _id: foreignCustomerId, name: 'X', email: 'x@x.com', phone: '0', loyaltyPoints: {} }]);

    const rawToken = sessionCookieFor(db, tenantA);
    const req: any = new Request('http://localhost/api/appointments', {
      method: 'POST',
      headers: { cookie: `session=${rawToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: foreignCustomerId.toString(),
        barberId: foreignBarberId.toString(), // tenant B's barber
        serviceId: foreignServiceId.toString(), // tenant B's service
        dateTime: new Date().toISOString(),
      }),
    });

    const res = await POST(req);
    // Part 2 added the ownership check (mirrors /api/t/[tenantSlug]/book):
    // barber/service/customer are each looked up scoped to session.tenantId
    // before insertOne, so a cross-tenant reference now 400s instead of
    // silently creating a cross-tenant-referencing appointment.
    expect(res.status).toBe(400);

    const created = await db.collection('appointments').countDocuments({});
    expect(created).toBe(0); // nothing was inserted
  });
});
