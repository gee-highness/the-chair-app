// __tests__/tenant-scoping.test.ts
//
// IDOR regression tests: an authenticated admin of tenant A must not be able
// to read/update tenant B's documents by _id alone. Mass-assignment
// regression tests: a PUT body must not be able to set fields outside each
// route's ALLOWED_UPDATE_FIELDS (in particular: tenantId itself).
//
// Run with: npx vitest run __tests__/tenant-scoping.test.ts
// (Not executed in the audit sandbox — no network egress to install vitest.
// Written to run as-is once dependencies are installed; see package.json.)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { FakeDb } from './helpers/fakeMongo';
import crypto from 'crypto';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function rawTokenFor(db: any, session: { subjectId: ObjectId; subjectType: 'user' | 'customer'; role: string; tenantId?: ObjectId }) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    {
      tokenHash,
      subjectId: session.subjectId,
      subjectType: session.subjectType,
      tenantId: session.tenantId,
      role: session.role,
      expiresAt: new Date(Date.now() + 60_000),
    },
  ]);
  return rawToken;
}

function requestWithSession(rawToken: string, body?: any) {
  return new Request('http://localhost/api/test', {
    method: body ? 'PUT' : 'GET',
    headers: {
      cookie: `session=${rawToken}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('tenant scoping — IDOR regression', () => {
  let tenantA: ObjectId, tenantB: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    tenantB = new ObjectId();
  });

  it('services PUT: admin of tenant A cannot edit tenant B service by _id', async () => {
    const { PUT } = await import('@/app/api/services/route');
    const db = fakeDb.db as FakeDb;

    const tenantBServiceId = new ObjectId();
    db.collection('services').seed([
      { _id: tenantBServiceId, tenantId: tenantB, name: 'Beard Trim (Tenant B)', duration: 20, price: 15 },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: tenantBServiceId.toString(), name: 'HACKED' });

    const res = await PUT(req);
    expect(res.status).toBe(404); // scoped filter finds nothing for tenant A

    const stillIntact = await db.collection('services').findOne({ _id: tenantBServiceId });
    expect(stillIntact?.name).toBe('Beard Trim (Tenant B)'); // untouched
  });

  it('barbers PUT: cannot edit another tenant\'s barber by _id', async () => {
    const { PUT } = await import('@/app/api/barbers/route');
    const db = fakeDb.db as FakeDb;

    const foreignBarberId = new ObjectId();
    db.collection('barbers').seed([{ _id: foreignBarberId, tenantId: tenantB, name: 'Real Barber', slug: 'real' }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: foreignBarberId.toString(), name: 'Renamed By Attacker' });

    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it('appointments PUT: cannot change status of another tenant\'s appointment', async () => {
    const { PUT } = await import('@/app/api/appointments/route');
    const db = fakeDb.db as FakeDb;

    const foreignApptId = new ObjectId();
    db.collection('appointments').seed([
      { _id: foreignApptId, tenantId: tenantB, status: 'pending', log: [] },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: foreignApptId.toString(), status: 'cancelled' });

    const res = await PUT(req);
    expect(res.status).toBe(404);

    const stillPending = await db.collection('appointments').findOne({ _id: foreignApptId });
    expect(stillPending?.status).toBe('pending');
  });

  it('customers PUT: cannot edit a customer with no loyalty relationship to caller\'s tenant', async () => {
    const { PUT } = await import('@/app/api/customers/route');
    const db = fakeDb.db as FakeDb;

    const strangerCustomerId = new ObjectId();
    db.collection('customers').seed([
      { _id: strangerCustomerId, name: 'Stranger', email: 's@example.com', phone: '000', loyaltyPoints: { [tenantB.toString()]: 10 } },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: strangerCustomerId.toString(), name: 'Renamed' });

    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it('reviews PUT: admin of tenant A cannot moderate tenant B\'s review by _id', async () => {
    const { PUT } = await import('@/app/api/reviews/route');
    const db = fakeDb.db as FakeDb;

    const foreignReviewId = new ObjectId();
    db.collection('reviews').seed([
      { _id: foreignReviewId, tenantId: tenantB, customerId: new ObjectId(), appointmentId: new ObjectId(), rating: 5, status: 'visible', createdAt: new Date() },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: foreignReviewId.toString(), status: 'flagged' });

    const res = await PUT(req);
    expect(res.status).toBe(404);

    const stillVisible = await db.collection('reviews').findOne({ _id: foreignReviewId });
    expect(stillVisible?.status).toBe('visible'); // untouched
  });
});

describe('mass-assignment regression — PUT allow-lists', () => {
  let tenantA: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
  });

  it('services PUT ignores a client-supplied tenantId and cannot reassign the document to another tenant', async () => {
    const { PUT } = await import('@/app/api/services/route');
    const db = fakeDb.db as FakeDb;
    const otherTenant = new ObjectId();

    const serviceId = new ObjectId();
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Haircut', duration: 30, price: 25 }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, {
      _id: serviceId.toString(),
      name: 'Haircut Deluxe',
      tenantId: otherTenant.toString(), // not in ALLOWED_UPDATE_FIELDS — must be dropped
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    const updated = await db.collection('services').findOne({ _id: serviceId });
    expect(updated?.name).toBe('Haircut Deluxe'); // allowed field applied
    expect(updated?.tenantId.toString()).toBe(tenantA.toString()); // tenantId untouched
  });

  it('customers PUT ignores email/passwordHash/loyaltyPoints even if supplied', async () => {
    const { PUT } = await import('@/app/api/customers/route');
    const db = fakeDb.db as FakeDb;

    const customerId = new ObjectId();
    db.collection('customers').seed([
      { _id: customerId, name: 'Jane', email: 'jane@example.com', phone: '111', passwordHash: 'original-hash', loyaltyPoints: { [tenantA.toString()]: 5 } },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, {
      _id: customerId.toString(),
      name: 'Jane Doe',
      email: 'attacker@evil.com',
      passwordHash: 'attacker-controlled',
      loyaltyPoints: { [tenantA.toString()]: 999999 },
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    const updated = await db.collection('customers').findOne({ _id: customerId });
    expect(updated?.name).toBe('Jane Doe');
    expect(updated?.email).toBe('jane@example.com'); // unchanged
    expect(updated?.passwordHash).toBe('original-hash'); // unchanged
    expect(updated?.loyaltyPoints[tenantA.toString()]).toBe(5); // unchanged
  });

  it('appointments PUT cannot set status outside the enum', async () => {
    const { PUT } = await import('@/app/api/appointments/route');
    const db = fakeDb.db as FakeDb;

    const apptId = new ObjectId();
    db.collection('appointments').seed([{ _id: apptId, tenantId: tenantA, status: 'pending', log: [] }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: apptId.toString(), status: 'definitely-paid-cash-no-refund' });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('reviews PUT rejects a status outside the visible/flagged enum', async () => {
    const { PUT } = await import('@/app/api/reviews/route');
    const db = fakeDb.db as FakeDb;

    const reviewId = new ObjectId();
    db.collection('reviews').seed([
      { _id: reviewId, tenantId: tenantA, customerId: new ObjectId(), appointmentId: new ObjectId(), rating: 4, status: 'visible', createdAt: new Date() },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: reviewId.toString(), status: 'deleted-forever' });

    const res = await PUT(req);
    expect(res.status).toBe(400);

    const untouched = await db.collection('reviews').findOne({ _id: reviewId });
    expect(untouched?.status).toBe('visible');
  });

  it('reviews PUT is admin-only — a receptionist session cannot moderate reviews', async () => {
    const { PUT } = await import('@/app/api/reviews/route');
    const db = fakeDb.db as FakeDb;

    const reviewId = new ObjectId();
    db.collection('reviews').seed([
      { _id: reviewId, tenantId: tenantA, customerId: new ObjectId(), appointmentId: new ObjectId(), rating: 4, status: 'visible', createdAt: new Date() },
    ]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), subjectType: 'user', role: 'receptionist', tenantId: tenantA });
    const req: any = requestWithSession(rawToken, { _id: reviewId.toString(), status: 'flagged' });

    const res = await PUT(req);
    expect(res.status).toBe(401); // requireRole(['admin']) — receptionist is not admin
  });
});
