// __tests__/services.test.ts
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

function req(method: string, rawToken?: string, body?: any, url = 'http://localhost/api/services') {
  return nextRequest(url, {
    method,
    headers: { ...(rawToken ? { cookie: `session=${rawToken}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/services', () => {
  it('only returns the caller\'s own tenant\'s services', async () => {
    const { GET } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    db.collection('services').seed([
      { _id: new ObjectId(), tenantId: tenantA, name: 'Fade', duration: 30, price: 25 },
      { _id: new ObjectId(), tenantId: tenantB, name: 'Coloring', duration: 90, price: 80 },
    ]);
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await GET(req('GET', rawToken));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Fade');
  });
});

describe('POST /api/services', () => {
  it('rejects missing required fields (price === undefined is explicitly checked, not just falsy)', async () => {
    const { POST } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'No price', duration: 30 }));
    expect(res.status).toBe(400);
  });

  it('accepts price: 0 (a free service) — the missing-field check must not treat 0 as missing', async () => {
    const { POST } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'Free consult', duration: 15, price: 0 }));
    expect(res.status).toBe(201);
  });

  it('converts a categoryId string to an ObjectId on create', async () => {
    const { POST } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const categoryId = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'Fade', duration: 30, price: 25, categoryId: categoryId.toString() }));
    const body = await res.json();
    expect(body.categoryId).toBe(categoryId.toString()); // serialized back as a string over JSON, but was stored as ObjectId
    const stored = await db.collection('services').findOne({ _id: new ObjectId(body._id) });
    expect(stored?.categoryId).toBeInstanceOf(ObjectId);
  });

  it('receptionist cannot create a service (admin-only)', async () => {
    const { POST } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'Fade', duration: 30, price: 25 }));
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/services', () => {
  it('refuses to delete a service with an upcoming appointment (409)', async () => {
    const { DELETE } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const serviceId = new ObjectId();
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantA, name: 'Fade', duration: 30, price: 25 }]);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    db.collection('appointments').seed([{ _id: new ObjectId(), tenantId: tenantA, serviceId, status: 'pending', dateTime: future }]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/services?id=${serviceId}`));
    expect(res.status).toBe(409);
  });

  it('cannot delete another tenant\'s service by id (404, not a cross-tenant delete)', async () => {
    const { DELETE } = await import('@/app/api/services/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    const serviceId = new ObjectId();
    db.collection('services').seed([{ _id: serviceId, tenantId: tenantB, name: 'Foreign', duration: 30, price: 25 }]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/services?id=${serviceId}`));
    expect(res.status).toBe(404);
    expect(await db.collection('services').countDocuments({})).toBe(1); // untouched
  });
});
