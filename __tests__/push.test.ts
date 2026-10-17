// __tests__/push.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';

const mocks = vi.hoisted(() => ({ db: null as any, sent: [] as any[], failWith: null as null | number }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => mocks.db,
  connectToDatabase: async () => ({ db: mocks.db, client: {} }),
}));
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: any, payload: string) => {
      if (mocks.failWith) throw Object.assign(new Error('push failed'), { statusCode: mocks.failWith });
      mocks.sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    }),
  },
}));

const hash = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');
const sub = (n: string) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });

function staffCookie(db: FakeDb, role: string, tenantId: ObjectId, extra: Record<string, any> = {}) {
  const raw = crypto.randomBytes(16).toString('hex');
  const subjectId = new ObjectId();
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(raw), subjectId, subjectType: 'user', role, tenantId, expiresAt: new Date(Date.now() + 60_000), ...extra },
  ]);
  return { cookie: `session=${raw}`, subjectId };
}

const post = (body: any, cookie?: string) =>
  nextRequest('http://localhost/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

describe('web push', () => {
  let tenantId: ObjectId;
  beforeEach(() => {
    mocks.db = new FakeDb();
    mocks.sent = [];
    mocks.failWith = null;
    tenantId = new ObjectId();
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
  });
  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  describe('GET /api/push/key', () => {
    it('returns the public key, or null when push is not configured', async () => {
      const { GET } = await import('@/app/api/push/key/route');
      expect((await (await GET()).json()).publicKey).toBe('pub');
      delete process.env.VAPID_PUBLIC_KEY;
      expect((await (await GET()).json()).publicKey).toBeNull();
    });
  });

  describe('POST /api/push/subscribe', () => {
    it('requires a staff session', async () => {
      const { POST } = await import('@/app/api/push/subscribe/route');
      expect((await POST(post(sub('a')))).status).toBe(401);
    });

    it('stores one subscription per device, scoped to the signed-in person and their salon', async () => {
      const { POST } = await import('@/app/api/push/subscribe/route');
      const { cookie, subjectId } = staffCookie(mocks.db, 'receptionist', tenantId);
      expect((await POST(post(sub('a'), cookie))).status).toBe(201);
      expect((await POST(post(sub('a'), cookie))).status).toBe(201); // same device again
      const rows = mocks.db.collection('pushSubscriptions').docs;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ role: 'receptionist', endpoint: 'https://push.example/a' });
      expect(rows[0].tenantId.equals(tenantId)).toBe(true);
      expect(rows[0].subjectId.equals(subjectId)).toBe(true);
    });

    it('rejects malformed or non-https subscriptions', async () => {
      const { POST } = await import('@/app/api/push/subscribe/route');
      const { cookie } = staffCookie(mocks.db, 'admin', tenantId);
      expect((await POST(post({ endpoint: 'http://insecure.example/x', keys: { p256dh: 'p', auth: 'a' } }, cookie))).status).toBe(400);
      expect((await POST(post({ endpoint: 'https://ok.example/x' }, cookie))).status).toBe(400);
    });

    it('answers 503 when push is not configured', async () => {
      delete process.env.VAPID_PRIVATE_KEY;
      const { POST } = await import('@/app/api/push/subscribe/route');
      const { cookie } = staffCookie(mocks.db, 'admin', tenantId);
      expect((await POST(post(sub('a'), cookie))).status).toBe(503);
    });
  });

  describe('DELETE /api/push/subscribe', () => {
    it('removes only the caller’s own subscription', async () => {
      const { POST, DELETE } = await import('@/app/api/push/subscribe/route');
      const mine = staffCookie(mocks.db, 'admin', tenantId);
      const theirs = staffCookie(mocks.db, 'admin', tenantId);
      await POST(post(sub('mine'), mine.cookie));
      await POST(post(sub('theirs'), theirs.cookie));
      const del = (endpoint: string, cookie: string) =>
        DELETE(nextRequest('http://localhost/api/push/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ endpoint }) }));
      await del('https://push.example/theirs', mine.cookie); // not mine: ignored
      expect(mocks.db.collection('pushSubscriptions').docs).toHaveLength(2);
      await del('https://push.example/mine', mine.cookie);
      expect(mocks.db.collection('pushSubscriptions').docs.map((d: any) => d.endpoint)).toEqual(['https://push.example/theirs']);
    });
  });

  describe('notifyNewBooking', () => {
    const run = async (barberId: ObjectId) => {
      const { notifyNewBooking } = await import('@/lib/push');
      return notifyNewBooking(mocks.db, { tenantId, tenantSlug: 'demo', barberId, customerName: 'Jamie', serviceName: 'Fade', dateTime: new Date('2026-10-20T09:00:00Z') });
    };

    it('alerts owners, receptionists and the booked barber, and nobody else', async () => {
      const booked = new ObjectId();
      mocks.db.collection('pushSubscriptions').seed([
        { tenantId, role: 'admin', barberId: null, ...sub('owner') },
        { tenantId, role: 'receptionist', barberId: null, ...sub('desk') },
        { tenantId, role: 'barber', barberId: booked, ...sub('booked-barber') },
        { tenantId, role: 'barber', barberId: new ObjectId(), ...sub('other-barber') },
        { tenantId: new ObjectId(), role: 'admin', barberId: null, ...sub('other-salon') },
      ]);
      expect(await run(booked)).toBe(3);
      expect(mocks.sent.map((s) => s.endpoint).sort()).toEqual(['https://push.example/booked-barber', 'https://push.example/desk', 'https://push.example/owner']);
      expect(mocks.sent[0].payload).toMatchObject({ title: 'New booking', url: '/t/demo/dashboard/appointments' });
      expect(mocks.sent[0].payload.body).toContain('Jamie');
    });

    it('forgets devices the push service reports as gone', async () => {
      mocks.db.collection('pushSubscriptions').seed([{ tenantId, role: 'admin', barberId: null, ...sub('stale') }]);
      mocks.failWith = 410;
      expect(await run(new ObjectId())).toBe(0);
      expect(mocks.db.collection('pushSubscriptions').docs).toHaveLength(0);
    });

    it('does nothing when push is not configured', async () => {
      delete process.env.VAPID_PRIVATE_KEY;
      mocks.db.collection('pushSubscriptions').seed([{ tenantId, role: 'admin', barberId: null, ...sub('owner') }]);
      expect(await run(new ObjectId())).toBe(0);
      expect(mocks.sent).toHaveLength(0);
    });
  });
});
