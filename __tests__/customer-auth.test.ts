// __tests__/customer-auth.test.ts
//
// The customer session cookie (customerAuth.ts): read "who am I" from it and
// sign out. Customers sign in with email + password through /api/auth/login.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function jsonReq(url: string, method: 'GET' | 'POST', body?: any, cookie?: string) {
  return nextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/customer-auth/me', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('returns 401 with no claim cookie', async () => {
    const { GET } = await import('@/app/api/customer-auth/me/route');
    const res = await GET(jsonReq('http://localhost/api/customer-auth/me', 'GET'));
    expect(res.status).toBe(401);
  });

  it('returns the signed-in customer\'s name/email for a valid claim', async () => {
    const { GET } = await import('@/app/api/customer-auth/me/route');
    const db = fakeDb.db as FakeDb;
    const customerId = new ObjectId();
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([{ tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) }]);
    db.collection('customers').seed([{ _id: customerId, name: 'Jamie', email: 'jamie@example.test' }]);

    const res = await GET(jsonReq('http://localhost/api/customer-auth/me', 'GET', undefined, `customerClaim=${rawToken}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Jamie');
    expect(body.email).toBe('jamie@example.test');
  });

  it('returns 401 if the claim is valid but the customer document was somehow deleted', async () => {
    const { GET } = await import('@/app/api/customer-auth/me/route');
    const db = fakeDb.db as FakeDb;
    const customerId = new ObjectId();
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([{ tokenHash: hash(rawToken), customerId, expiresAt: new Date(Date.now() + 60_000) }]);
    // No matching customer document seeded.

    const res = await GET(jsonReq('http://localhost/api/customer-auth/me', 'GET', undefined, `customerClaim=${rawToken}`));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/customer-auth/logout', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('deletes the claim session and clears the cookie', async () => {
    const { POST } = await import('@/app/api/customer-auth/logout/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = crypto.randomBytes(16).toString('hex');
    db.collection('customerClaimSessions').seed([{ tokenHash: hash(rawToken), customerId: new ObjectId(), expiresAt: new Date(Date.now() + 60_000) }]);

    const res = await POST(jsonReq('http://localhost/api/customer-auth/logout', 'POST', undefined, `customerClaim=${rawToken}`));
    expect(res.status).toBe(200);
    expect(await db.collection('customerClaimSessions').countDocuments({})).toBe(0);
    expect(res.headers.get('set-cookie') || '').toMatch(/customerClaim=/);
  });
});
