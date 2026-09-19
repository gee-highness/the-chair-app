// __tests__/appointments.test.ts
import { describe, it, expect, vi } from 'vitest';
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

function staffToken(db: FakeDb, role: string, tenantId: ObjectId, subjectId = new ObjectId()) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId, subjectType: 'user', role, tenantId, expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function req(method: string, rawToken?: string, body?: any) {
  return nextRequest('http://localhost/api/appointments', {
    method,
    headers: { ...(rawToken ? { cookie: `session=${rawToken}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/appointments', () => {
  it('populates barber/service/customer names and only returns the caller\'s tenant', async () => {
    const { GET } = await import('@/app/api/appointments/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    const barberId = new ObjectId();
    const serviceId = new ObjectId();
    const customerId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex' }]);
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Fade', price: 25, duration: 30 }]);
    db.collection('customers').seed([{ _id: customerId, name: 'Jamie', phone: '555-0100' }]);
    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId: tenantA, barberId, serviceId, customerId, dateTime: new Date(), status: 'pending' },
      { _id: new ObjectId(), tenantId: tenantB, barberId, serviceId, customerId, dateTime: new Date(), status: 'pending' },
    ]);

    const rawToken = staffToken(db, 'barber', tenantA);
    const res = await GET(req('GET', rawToken));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].barberName).toBe('Alex');
    expect(body[0].serviceName).toBe('Fade');
    expect(body[0].customerName).toBe('Jamie');
  });
});

describe('POST /api/appointments', () => {
  let tenantA: ObjectId, barberId: ObjectId, serviceId: ObjectId, customerId: ObjectId;
  function seedCore(db: FakeDb) {
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex' }]);
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Fade', price: 25, duration: 30 }]);
    db.collection('customers').seed([{ _id: customerId, name: 'Jamie', loyaltyPoints: { [tenantA.toString()]: 0 } }]);
  }

  it('barber role cannot create a walk-in (admin/receptionist only)', async () => {
    const db = (fakeDb.db = new FakeDb());
    tenantA = new ObjectId(); barberId = new ObjectId(); serviceId = new ObjectId(); customerId = new ObjectId();
    seedCore(db);
    const { POST } = await import('@/app/api/appointments/route');
    const rawToken = staffToken(db, 'barber', tenantA);
    const res = await POST(req('POST', rawToken, { customerId: customerId.toString(), barberId: barberId.toString(), serviceId: serviceId.toString(), dateTime: new Date().toISOString() }));
    expect(res.status).toBe(401);
  });

  it('rejects a barberId belonging to a different tenant', async () => {
    const db = (fakeDb.db = new FakeDb());
    tenantA = new ObjectId(); serviceId = new ObjectId(); customerId = new ObjectId();
    const foreignBarberId = new ObjectId();
    db.collection('barbers').seed([{ _id: foreignBarberId, tenantId: new ObjectId(), name: 'Foreign' }]); // different tenant
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Fade', price: 25, duration: 30 }]);
    db.collection('customers').seed([{ _id: customerId, loyaltyPoints: { [tenantA.toString()]: 0 } }]);

    const { POST } = await import('@/app/api/appointments/route');
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await POST(req('POST', rawToken, { customerId: customerId.toString(), barberId: foreignBarberId.toString(), serviceId: serviceId.toString(), dateTime: new Date().toISOString() }));
    expect(res.status).toBe(400);
  });

  it('rejects a customer with no loyalty relationship to this tenant', async () => {
    const db = (fakeDb.db = new FakeDb());
    tenantA = new ObjectId(); barberId = new ObjectId(); serviceId = new ObjectId();
    const strangerCustomer = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex' }]);
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Fade', price: 25, duration: 30 }]);
    db.collection('customers').seed([{ _id: strangerCustomer, loyaltyPoints: {} }]); // no entry for tenantA

    const { POST } = await import('@/app/api/appointments/route');
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await POST(req('POST', rawToken, { customerId: strangerCustomer.toString(), barberId: barberId.toString(), serviceId: serviceId.toString(), dateTime: new Date().toISOString() }));
    expect(res.status).toBe(400);
  });

  it('a walk-in with status:"waitlist" does not require a dateTime', async () => {
    const db = (fakeDb.db = new FakeDb());
    tenantA = new ObjectId(); barberId = new ObjectId(); serviceId = new ObjectId(); customerId = new ObjectId();
    seedCore(db);
    const { POST } = await import('@/app/api/appointments/route');
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await POST(req('POST', rawToken, { customerId: customerId.toString(), barberId: barberId.toString(), serviceId: serviceId.toString(), status: 'waitlist' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('waitlist');
  });

  it('records a "created" log entry attributed to the acting staff member', async () => {
    const db = (fakeDb.db = new FakeDb());
    tenantA = new ObjectId(); barberId = new ObjectId(); serviceId = new ObjectId(); customerId = new ObjectId();
    seedCore(db);
    const staffSubjectId = new ObjectId();
    const { POST } = await import('@/app/api/appointments/route');
    const rawToken = staffToken(db, 'receptionist', tenantA, staffSubjectId);
    const res = await POST(req('POST', rawToken, { customerId: customerId.toString(), barberId: barberId.toString(), serviceId: serviceId.toString(), dateTime: new Date().toISOString() }));
    const body = await res.json();
    expect(body.log[0].action).toBe('created');
    expect(body.log[0].changedBy).toBe(`receptionist:${staffSubjectId.toString()}`);
  });
});
