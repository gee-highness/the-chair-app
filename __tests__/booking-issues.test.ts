// __tests__/booking-issues.test.ts
//
// A booking that can't go ahead (clash or outside hours) is recorded for
// staff, who are alerted and can mark it sorted.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';

const mocks = vi.hoisted(() => ({ db: null as any, sent: [] as any[] }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => mocks.db,
  connectToDatabase: async () => ({ db: mocks.db, client: {} }),
}));
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: any, payload: string) => {
      mocks.sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    }),
  },
}));

const DAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const hash = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');
const allDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:59' }));

function staffCookie(db: FakeDb, role: string, tenantId: ObjectId, extra: Record<string, any> = {}) {
  const raw = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(raw), subjectId: new ObjectId(), subjectType: 'user', role, tenantId, expiresAt: new Date(Date.now() + 60_000), ...extra },
  ]);
  return `session=${raw}`;
}

describe('blocked bookings reach staff', () => {
  let db: FakeDb, tenantId: ObjectId, barberId: ObjectId, serviceId: ObjectId;

  const book = async (time: string, email = 'casey@example.com') => {
    const { POST } = await import('@/app/api/t/[tenantSlug]/book/route');
    return POST(
      new Request('http://localhost/api/t/demo/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Casey', customerEmail: email, customerPhone: '555-0100',
          serviceId: serviceId.toString(), barberId: barberId.toString(), dateTime: new Date(`${DAY}T${time}:00`).toISOString(),
        }),
      }) as any,
      { params: Promise.resolve({ tenantSlug: 'demo' }) }
    );
  };

  beforeEach(() => {
    db = new FakeDb();
    mocks.db = db;
    mocks.sent = [];
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    tenantId = new ObjectId();
    barberId = new ObjectId();
    serviceId = new ObjectId();
    db.collection('tenants').seed([{ _id: tenantId, slug: 'demo', status: 'active' }]);
    db.collection('barbers').seed([{ _id: barberId, tenantId, name: 'Alex', dailyAvailability: allDay }]);
    db.collection('services').seed([{ _id: serviceId, tenantId, name: 'Fade', duration: 30, price: 25 }]);
    db.collection('pushSubscriptions').seed([
      { tenantId, subjectId: new ObjectId(), role: 'admin', endpoint: 'https://push.example/admin', keys: { p256dh: 'p', auth: 'a' } },
    ]);
  });
  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('records an overlap, tells the customer 409, and alerts staff', async () => {
    const first = await book('10:00', 'first@example.com');
    expect(first.status).toBe(201);

    const second = await book('10:15');
    expect(second.status).toBe(409);

    const issues = db.collection('bookingIssues').docs;
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ tenantId, barberId, reason: 'overlap', status: 'open', customerEmail: 'casey@example.com' });
    expect(issues[0].conflictAppointmentId).toBeTruthy();
    expect(mocks.sent.map((s) => s.payload.title)).toContain('Booking needs attention');
    expect(db.collection('appointments').docs).toHaveLength(1);
  });

  it('records a booking outside working hours as unavailable', async () => {
    db.collection('barbers').seed([{ _id: barberId, tenantId, name: 'Alex', dailyAvailability: [] }]);
    expect((await book('10:00')).status).toBe(409);
    expect(db.collection('bookingIssues').docs[0]).toMatchObject({ reason: 'unavailable', status: 'open' });
  });

  it('does not record the same blocked request twice while it is open', async () => {
    await book('10:00', 'first@example.com');
    await book('10:15');
    await book('10:15');
    expect(db.collection('bookingIssues').docs).toHaveLength(1);
  });

  it('lists issues to staff of that salon only, and a barber sees only their own', async () => {
    await book('10:00', 'first@example.com');
    await book('10:15');
    const { GET } = await import('@/app/api/booking-issues/route');
    const url = 'http://localhost/api/booking-issues';

    expect((await GET(nextRequest(url))).status).toBe(401);

    const admin = await (await GET(nextRequest(url, { headers: { cookie: staffCookie(db, 'admin', tenantId) } }))).json();
    expect(admin).toHaveLength(1);
    expect(admin[0]).toMatchObject({ barberName: 'Alex', serviceName: 'Fade' });

    const other = await (await GET(nextRequest(url, { headers: { cookie: staffCookie(db, 'admin', new ObjectId()) } }))).json();
    expect(other).toHaveLength(0);

    const mine = await (await GET(nextRequest(url, { headers: { cookie: staffCookie(db, 'barber', tenantId, { barberId }) } }))).json();
    expect(mine).toHaveLength(1);
    const notMine = await (await GET(nextRequest(url, { headers: { cookie: staffCookie(db, 'barber', tenantId, { barberId: new ObjectId() }) } }))).json();
    expect(notMine).toHaveLength(0);
  });

  it('marks an issue sorted, only within the same salon', async () => {
    await book('10:00', 'first@example.com');
    await book('10:15');
    const id = db.collection('bookingIssues').docs[0]._id.toString();
    const { PUT } = await import('@/app/api/booking-issues/route');
    const put = (cookie: string) =>
      PUT(nextRequest('http://localhost/api/booking-issues', { method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ _id: id, resolutionNote: 'Rebooked 11:00' }) }));

    expect((await put(staffCookie(db, 'admin', new ObjectId()))).status).toBe(404);
    expect((await put(staffCookie(db, 'receptionist', tenantId))).status).toBe(200);
    expect(db.collection('bookingIssues').docs[0]).toMatchObject({ status: 'resolved', resolutionNote: 'Rebooked 11:00' });
  });
});
