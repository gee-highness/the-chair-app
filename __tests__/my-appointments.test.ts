// __tests__/my-appointments.test.ts
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

function callGet(tenantSlug: string, cookie?: string) {
  return import('@/app/api/t/[tenantSlug]/my-appointments/route').then(({ GET }) =>
    GET(
      nextRequest(`http://localhost/api/t/${tenantSlug}/my-appointments`, { headers: cookie ? { cookie } : {} }),
      { params: Promise.resolve({ tenantSlug }) }
    )
  );
}

describe('GET /api/t/[tenantSlug]/my-appointments', () => {
  let tenantId: ObjectId, customerId: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantId = new ObjectId();
    customerId = new ObjectId();
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, slug: 'demo', name: 'Demo Salon', status: 'active' }]);
  });

  it('requires a signed-in customer', async () => {
    const res = await callGet('demo');
    expect(res.status).toBe(401);
  });

  it('404s for a tenant slug that does not exist', async () => {
    const db = fakeDb.db as FakeDb;
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([{ tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) }]);
    const res = await callGet('nope', `customerClaim=${rawToken}`);
    expect(res.status).toBe(404);
  });

  it('returns only THIS customer\'s appointments at THIS tenant, populated with barber/service names, plus loyalty points', async () => {
    const db = fakeDb.db as FakeDb;
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([{ tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) }]);

    const barberId = new ObjectId();
    const serviceId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId, name: 'Alex' }]);
    db.collection('services').seed([{ _id: serviceId, tenantId, name: 'Fade', price: 25, duration: 30 }]);

    const otherCustomer = new ObjectId();
    const otherTenant = new ObjectId();
    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId, customerId, barberId, serviceId, dateTime: new Date('2026-05-01'), status: 'completed' },
      { _id: new ObjectId(), tenantId, customerId: otherCustomer, barberId, serviceId, dateTime: new Date(), status: 'confirmed' }, // different customer
      { _id: new ObjectId(), tenantId: otherTenant, customerId, barberId, serviceId, dateTime: new Date(), status: 'confirmed' }, // different tenant
    ]);
    db.collection('customers').seed([{ _id: customerId, name: 'Jamie', loyaltyPoints: { [tenantId.toString()]: 15 } }]);

    const res = await callGet('demo', `customerClaim=${rawToken}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments).toHaveLength(1); // only this customer, this tenant
    expect(body.appointments[0].barberName).toBe('Alex');
    expect(body.appointments[0].serviceName).toBe('Fade');
    expect(body.loyaltyPoints).toBe(15);
  });

  it('loyaltyPoints defaults to 0 when the customer has no entry for this tenant yet', async () => {
    const db = fakeDb.db as FakeDb;
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([{ tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) }]);
    db.collection('customers').seed([{ _id: customerId, name: 'Jamie', loyaltyPoints: {} }]);

    const res = await callGet('demo', `customerClaim=${rawToken}`);
    const body = await res.json();
    expect(body.loyaltyPoints).toBe(0);
  });
});
