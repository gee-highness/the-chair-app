// __tests__/book-slots.test.ts
//
// GET /api/t/[tenantSlug]/book — the availability-grid endpoint the
// booking page's step 3 calls. POST (the actual booking + double-booking
// guard) is covered in booking.test.ts; this file covers GET only.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { FakeDb } from './helpers/fakeMongo';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function callGet(tenantSlug: string, query: string) {
  return import('@/app/api/t/[tenantSlug]/book/route').then(({ GET }) =>
    GET(new Request(`http://localhost/api/t/${tenantSlug}/book${query}`) as any, { params: Promise.resolve({ tenantSlug }) })
  );
}

describe('GET /api/t/[tenantSlug]/book', () => {
  let tenantId: ObjectId, barberId: ObjectId, serviceId: ObjectId;
  const allDayEveryDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:59' }));

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantId = new ObjectId();
    barberId = new ObjectId();
    serviceId = new ObjectId();
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, slug: 'demo', status: 'active' }]);
    db.collection('barbers').seed([{ _id: barberId, tenantId, name: 'Alex', dailyAvailability: allDayEveryDay }]);
    db.collection('services').seed([{ _id: serviceId, tenantId, name: 'Fade', duration: 30, price: 25 }]);
  });

  it('404s for a tenant slug that does not exist', async () => {
    const res = await callGet('nope', `?barberId=${barberId}&serviceId=${serviceId}&date=2026-06-01`);
    expect(res.status).toBe(404);
  });

  it('rejects a missing barberId/serviceId/date', async () => {
    const res = await callGet('demo', '?barberId=' + barberId);
    expect(res.status).toBe(400);
  });

  it('400s for a barberId that does not belong to this tenant', async () => {
    const foreignBarber = new ObjectId();
    const res = await callGet('demo', `?barberId=${foreignBarber}&serviceId=${serviceId}&date=2026-06-01`);
    expect(res.status).toBe(400);
  });

  it('returns open slots for a barber with no existing appointments that day', async () => {
    const res = await callGet('demo', `?barberId=${barberId}&serviceId=${serviceId}&date=2026-06-01`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slots.length).toBeGreaterThan(0);
  });

  it('excludes a slot already booked (pending/confirmed) for that barber that day', async () => {
    const db = fakeDb.db as FakeDb;
    const bookedAt = new Date('2026-06-01T10:00:00');
    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId, barberId, serviceId, dateTime: bookedAt, status: 'confirmed' },
    ]);

    const res = await callGet('demo', `?barberId=${barberId}&serviceId=${serviceId}&date=2026-06-01`);
    const body = await res.json();
    expect(body.slots).not.toContain(bookedAt.toISOString());
  });

  it('a CANCELLED appointment does not block its slot (only pending/confirmed count as booked)', async () => {
    const db = fakeDb.db as FakeDb;
    const cancelledAt = new Date('2026-06-01T10:00:00');
    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId, barberId, serviceId, dateTime: cancelledAt, status: 'cancelled' },
    ]);

    const res = await callGet('demo', `?barberId=${barberId}&serviceId=${serviceId}&date=2026-06-01`);
    const body = await res.json();
    expect(body.slots).toContain(cancelledAt.toISOString());
  });
});
