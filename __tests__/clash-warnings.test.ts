// __tests__/clash-warnings.test.ts
//
// Staff get a clash warning (with an explicit override) before a booking is
// created or brought back over another of the same barber's bookings, and the
// board can find existing overlaps.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';
import { findClashes } from '@/lib/clashes';

const mocks = vi.hoisted(() => ({ db: null as any }));
vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => mocks.db,
  connectToDatabase: async () => ({ db: mocks.db, client: {} }),
}));

const hash = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');
const at = (h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  d.setHours(h, m, 0, 0);
  return d;
};

describe('findClashes', () => {
  const a = (id: string, h: number, m = 0, extra: Record<string, any> = {}) => ({
    _id: id, barberId: 'b1', dateTime: at(h, m).toISOString(), status: 'confirmed', serviceDuration: 30, customerName: id, ...extra,
  });

  it('pairs up overlapping live bookings of the same barber, both ways', () => {
    const c = findClashes([a('x', 10), a('y', 10, 15)]);
    expect(c.get('x')?.map((o) => o._id)).toEqual(['y']);
    expect(c.get('y')?.map((o) => o._id)).toEqual(['x']);
  });

  it('back-to-back bookings, other barbers, and non-live bookings do not clash', () => {
    expect(findClashes([a('x', 10), a('y', 10, 30)]).size).toBe(0);
    expect(findClashes([a('x', 10), a('y', 10, 15, { barberId: 'b2' })]).size).toBe(0);
    expect(findClashes([a('x', 10), a('y', 10, 15, { status: 'cancelled' })]).size).toBe(0);
    expect(findClashes([a('x', 10), a('y', 10, 15, { status: 'waitlist' })]).size).toBe(0);
  });

  it('uses each booking\'s own duration', () => {
    expect(findClashes([a('x', 10, 0, { serviceDuration: 90 }), a('y', 11, 0)]).get('y')).toBeTruthy();
  });
});

describe('staff booking clash warnings', () => {
  let db: FakeDb, tenantId: ObjectId, barberId: ObjectId, serviceId: ObjectId, customerId: ObjectId, cookie: string;

  beforeEach(() => {
    db = new FakeDb();
    mocks.db = db;
    tenantId = new ObjectId(); barberId = new ObjectId(); serviceId = new ObjectId(); customerId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId, name: 'Alex' }]);
    db.collection('services').seed([{ _id: serviceId, tenantId, name: 'Fade', duration: 30, price: 25 }]);
    db.collection('customers').seed([{ _id: customerId, name: 'Jamie', email: 'j@example.com', loyaltyPoints: { [tenantId.toString()]: 0 } }]);
    const raw = crypto.randomBytes(16).toString('hex');
    db.collection('sessions').seed([{ tokenHash: hash(raw), subjectId: new ObjectId(), subjectType: 'user', role: 'receptionist', tenantId, expiresAt: new Date(Date.now() + 60_000) }]);
    cookie = `session=${raw}`;
  });

  const existing = (h: number, m = 0, status = 'confirmed') => {
    const _id = new ObjectId();
    db.collection('appointments').seed([...db.collection('appointments').docs, { _id, tenantId, customerId, barberId, serviceId, dateTime: at(h, m), status, log: [] }]);
    return _id;
  };
  const post = async (body: any) => {
    const { POST } = await import('@/app/api/appointments/route');
    return POST(nextRequest('http://localhost/api/appointments', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }));
  };
  const put = async (body: any) => {
    const { PUT } = await import('@/app/api/appointments/route');
    return PUT(nextRequest('http://localhost/api/appointments', { method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }));
  };
  const base = () => ({ customerId: customerId.toString(), barberId: barberId.toString(), serviceId: serviceId.toString() });

  it('refuses a timed booking over another, naming who is in the way', async () => {
    existing(10);
    const res = await post({ ...base(), dateTime: at(10, 15).toISOString() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('clash');
    expect(body.message).toContain('Alex already has Jamie (Fade)');
    expect(db.collection('appointments').docs).toHaveLength(1);
  });

  it('books over the clash only when staff confirm with force, and records it', async () => {
    existing(10);
    const res = await post({ ...base(), dateTime: at(10, 15).toISOString(), force: true });
    expect(res.status).toBe(201);
    const docs = db.collection('appointments').docs;
    expect(docs).toHaveLength(2);
    expect(docs[1].log[0].action).toContain('overlaps another booking');
  });

  it('books normally with no clash, and the waitlist never clashes', async () => {
    existing(10);
    expect((await post({ ...base(), dateTime: at(11).toISOString() })).status).toBe(201);
    expect((await post({ ...base(), status: 'waitlist', source: 'walk-in' })).status).toBe(201);
  });

  it('warns before reopening a cancelled booking whose slot was taken, and allows it with force', async () => {
    existing(10);
    const cancelled = existing(10, 15, 'cancelled');
    const res = await put({ _id: cancelled.toString(), status: 'confirmed' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('clash');
    expect(db.collection('appointments').docs[1].status).toBe('cancelled');

    expect((await put({ _id: cancelled.toString(), status: 'confirmed', force: true })).status).toBe(200);
    expect(db.collection('appointments').docs[1].status).toBe('confirmed');
  });

  it('ordinary status changes (confirm a pending booking, complete, cancel) are never blocked', async () => {
    existing(10);
    const pending = existing(10, 15, 'pending'); // already clashing: confirming it is not a new clash
    expect((await put({ _id: pending.toString(), status: 'confirmed' })).status).toBe(200);
    expect((await put({ _id: pending.toString(), status: 'cancelled' })).status).toBe(200);
  });
});
