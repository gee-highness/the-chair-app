// __tests__/barbers.test.ts
//
// GET/POST/DELETE for /api/barbers. PUT (tenant-scoping + mass-assignment)
// is already covered in tenant-scoping.test.ts — not duplicated here.
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

function staffToken(db: FakeDb, role: string, tenantId: ObjectId) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: new ObjectId(), subjectType: 'user', role, tenantId, expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function req(method: string, rawToken?: string, body?: any, url = 'http://localhost/api/barbers') {
  return nextRequest(url, {
    method,
    headers: { ...(rawToken ? { cookie: `session=${rawToken}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/barbers', () => {
  it('only returns the caller\'s own tenant\'s barbers', async () => {
    const { GET } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    db.collection('barbers').seed([
      { _id: new ObjectId(), tenantId: tenantA, name: 'Alex', slug: 'alex', dailyAvailability: [] },
      { _id: new ObjectId(), tenantId: tenantB, name: 'Sam', slug: 'sam', dailyAvailability: [] },
    ]);
    const rawToken = staffToken(db, 'barber', tenantA);
    const res = await GET(req('GET', rawToken));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Alex');
  });
});

describe('POST /api/barbers', () => {
  it('receptionist cannot create a barber (admin-only)', async () => {
    const { POST } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'New Barber', slug: 'new-barber', dailyAvailability: [] }));
    expect(res.status).toBe(401);
  });

  it('rejects missing required fields', async () => {
    const { POST } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'No Slug Or Availability' }));
    expect(res.status).toBe(400);
  });

  it('admin creates a barber scoped to their own tenant', async () => {
    const { POST } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'New Barber', slug: 'new-barber', dailyAvailability: [] }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tenantId.toString()).toBe(tenantA.toString());
  });
});

describe('DELETE /api/barbers', () => {
  it('refuses to delete a barber with an upcoming appointment (409)', async () => {
    const { DELETE } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const barberId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex', slug: 'alex', dailyAvailability: [] }]);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    db.collection('appointments').seed([{ _id: new ObjectId(), tenantId: tenantA, barberId, status: 'confirmed', dateTime: future }]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/barbers?id=${barberId}`));
    expect(res.status).toBe(409);
    expect(await db.collection('barbers').countDocuments({})).toBe(1);
  });

  it('deletes a barber with no upcoming appointments', async () => {
    const { DELETE } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const barberId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex', slug: 'alex', dailyAvailability: [] }]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/barbers?id=${barberId}`));
    expect(res.status).toBe(200);
    expect(await db.collection('barbers').countDocuments({})).toBe(0);
  });

  it('a PAST appointment does not block deletion (only upcoming pending/confirmed/waitlist do)', async () => {
    const { DELETE } = await import('@/app/api/barbers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const barberId = new ObjectId();
    db.collection('barbers').seed([{ _id: barberId, tenantId: tenantA, name: 'Alex', slug: 'alex', dailyAvailability: [] }]);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    db.collection('appointments').seed([{ _id: new ObjectId(), tenantId: tenantA, barberId, status: 'completed', dateTime: past }]);

    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/barbers?id=${barberId}`));
    expect(res.status).toBe(200);
  });
});
