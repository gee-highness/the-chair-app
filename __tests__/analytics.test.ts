// __tests__/analytics.test.ts
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

function staffToken(db: FakeDb, role: string, tenantId: ObjectId) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: new ObjectId(), subjectType: 'user', role, tenantId, expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function req(rawToken?: string, days?: number) {
  return nextRequest(`http://localhost/api/analytics${days ? `?days=${days}` : ''}`, {
    headers: rawToken ? { cookie: `session=${rawToken}` } : {},
  });
}

describe('GET /api/analytics', () => {
  it('receptionist cannot view analytics (admin-only)', async () => {
    const { GET } = await import('@/app/api/analytics/route');
    const db = (fakeDb.db = new FakeDb());
    const rawToken = staffToken(db, 'receptionist', new ObjectId());
    const res = await GET(req(rawToken));
    expect(res.status).toBe(401);
  });

  it('buckets bookings by day, revenue only from completed appointments, and ranks barbers/services', async () => {
    const { GET } = await import('@/app/api/analytics/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const barberId = new ObjectId();
    const serviceId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex' }]);
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Fade', price: 25, duration: 30 }]);

    const day1 = new Date();
    day1.setDate(day1.getDate() - 1);
    const day2 = new Date();
    day2.setDate(day2.getDate() - 2);

    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId: tenantA, barberId, serviceId, dateTime: day1, status: 'completed' },
      { _id: new ObjectId(), tenantId: tenantA, barberId, serviceId, dateTime: day1, status: 'pending' }, // counts as a booking, NOT revenue
      { _id: new ObjectId(), tenantId: tenantA, barberId, serviceId, dateTime: day2, status: 'completed' },
    ]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await GET(req(rawToken, 30));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalBookings).toBe(3);
    expect(body.totalRevenue).toBe(50); // only the 2 completed appointments' $25 each
    expect(body.topBarbers[0]).toEqual({ name: 'Alex', count: 3 });
    expect(body.topServices[0]).toEqual({ name: 'Fade', count: 3 });
    expect(body.timeline).toHaveLength(2); // two distinct days
  });

  it('never includes another tenant\'s appointments', async () => {
    const { GET } = await import('@/app/api/analytics/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId: tenantB, dateTime: new Date(), status: 'completed' },
    ]);
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await GET(req(rawToken, 30));
    const body = await res.json();
    expect(body.totalBookings).toBe(0);
  });

  it('excludes appointments older than the requested window', async () => {
    const { GET } = await import('@/app/api/analytics/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const old = new Date();
    old.setDate(old.getDate() - 45);
    db.collection('appointments').seed([{ _id: new ObjectId(), tenantId: tenantA, dateTime: old, status: 'completed' }]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await GET(req(rawToken, 30)); // 30-day window — the 45-day-old appointment is out of range
    const body = await res.json();
    expect(body.totalBookings).toBe(0);
  });

  it('clamps the days parameter to a maximum of 180', async () => {
    const { GET } = await import('@/app/api/analytics/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await GET(req(rawToken, 9999));
    const body = await res.json();
    expect(body.days).toBe(180);
  });
});
