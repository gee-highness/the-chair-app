// __tests__/favorites.test.ts
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

function claimCookieFor(db: FakeDb, customerId: ObjectId): string {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('customerClaimSessions').seed([
    ...db.collection('customerClaimSessions').docs,
    { tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return `customerClaim=${rawToken}`;
}

function req(method: string, url: string, body?: any, cookie?: string) {
  return nextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('favorites', () => {
  let customerId: ObjectId, tenantId: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    customerId = new ObjectId();
    tenantId = new ObjectId();
  });

  it('GET requires a signed-in customer', async () => {
    const { GET } = await import('@/app/api/favorites/route');
    const res = await GET(req('GET', 'http://localhost/api/favorites'));
    expect(res.status).toBe(401);
  });

  it('POST saves a favorite, and GET returns it joined with the tenant\'s name/slug/branding', async () => {
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, name: 'Fade Factory', slug: 'fade-factory', branding: { primaryColor: '#000' } }]);
    const cookie = claimCookieFor(db, customerId);

    const { POST } = await import('@/app/api/favorites/route');
    const postRes = await POST(req('POST', 'http://localhost/api/favorites', { tenantId: tenantId.toString() }, cookie));
    expect(postRes.status).toBe(201);

    const { GET } = await import('@/app/api/favorites/route');
    const getRes = await GET(req('GET', 'http://localhost/api/favorites', undefined, cookie));
    const body = await getRes.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Fade Factory');
    expect(body[0].slug).toBe('fade-factory');
  });

  it('POST is idempotent — favoriting the same tenant twice does not create a duplicate', async () => {
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, name: 'Fade Factory', slug: 'fade-factory', branding: {} }]);
    const cookie = claimCookieFor(db, customerId);
    const { POST } = await import('@/app/api/favorites/route');

    await POST(req('POST', 'http://localhost/api/favorites', { tenantId: tenantId.toString() }, cookie));
    await POST(req('POST', 'http://localhost/api/favorites', { tenantId: tenantId.toString() }, cookie));

    expect(await db.collection('favorites').countDocuments({})).toBe(1);
  });

  it('DELETE removes exactly this customer\'s favorite for that tenant', async () => {
    const db = fakeDb.db as FakeDb;
    const cookie = claimCookieFor(db, customerId);
    db.collection('favorites').seed([{ _id: new ObjectId(), customerId, tenantId, createdAt: new Date() }]);

    const { DELETE } = await import('@/app/api/favorites/route');
    const res = await DELETE(req('DELETE', `http://localhost/api/favorites?tenantId=${tenantId.toString()}`, undefined, cookie));
    expect(res.status).toBe(200);
    expect(await db.collection('favorites').countDocuments({})).toBe(0);
  });

  it('a customer cannot delete a different customer\'s favorite', async () => {
    const db = fakeDb.db as FakeDb;
    const otherCustomer = new ObjectId();
    db.collection('favorites').seed([{ _id: new ObjectId(), customerId: otherCustomer, tenantId, createdAt: new Date() }]);
    const cookie = claimCookieFor(db, customerId); // signed in as a DIFFERENT customer

    const { DELETE } = await import('@/app/api/favorites/route');
    await DELETE(req('DELETE', `http://localhost/api/favorites?tenantId=${tenantId.toString()}`, undefined, cookie));
    expect(await db.collection('favorites').countDocuments({})).toBe(1); // the other customer's favorite is untouched
  });

  it('rejects a missing tenantId on POST/DELETE', async () => {
    const db = fakeDb.db as FakeDb;
    const cookie = claimCookieFor(db, customerId);
    const { POST, DELETE } = await import('@/app/api/favorites/route');

    expect((await POST(req('POST', 'http://localhost/api/favorites', {}, cookie))).status).toBe(400);
    expect((await DELETE(req('DELETE', 'http://localhost/api/favorites', undefined, cookie))).status).toBe(400);
  });
});
