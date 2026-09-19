// __tests__/customer-auth.test.ts
//
// The lightweight customer-claim auth flow (customerAuth.ts): request a
// one-time code by email, verify it for a session cookie, read "who am
// I" from that cookie, and sign out. No password, no full account.
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

describe('POST /api/customer-auth/request', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the SAME generic message whether or not the email matches a customer (no enumeration signal)', async () => {
    const { POST } = await import('@/app/api/customer-auth/request/route');
    const db = fakeDb.db as FakeDb;
    db.collection('customers').seed([{ _id: new ObjectId(), email: 'real@example.test', name: 'Real Customer' }]);

    const forReal = await (await POST(jsonReq('http://localhost/api/customer-auth/request', 'POST', { email: 'real@example.test' }))).json();
    const forFake = await (await POST(jsonReq('http://localhost/api/customer-auth/request', 'POST', { email: 'nobody@example.test' }))).json();
    expect(forReal.message).toBe(forFake.message);
  });

  it('outside production, hands back devCode for an existing customer so the flow is testable without an email provider', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { POST } = await import('@/app/api/customer-auth/request/route');
    const db = fakeDb.db as FakeDb;
    db.collection('customers').seed([{ _id: new ObjectId(), email: 'real@example.test', name: 'Real Customer' }]);

    const body = await (await POST(jsonReq('http://localhost/api/customer-auth/request', 'POST', { email: 'real@example.test' }))).json();
    expect(body.devCode).toMatch(/^\d{6}$/);
  });

  it('does NOT return devCode in production, even for a real customer', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { POST } = await import('@/app/api/customer-auth/request/route');
    const db = fakeDb.db as FakeDb;
    db.collection('customers').seed([{ _id: new ObjectId(), email: 'real@example.test', name: 'Real Customer' }]);

    const body = await (await POST(jsonReq('http://localhost/api/customer-auth/request', 'POST', { email: 'real@example.test' }))).json();
    expect(body.devCode).toBeUndefined();
  });

  it('rejects a missing email', async () => {
    const { POST } = await import('@/app/api/customer-auth/request/route');
    const res = await POST(jsonReq('http://localhost/api/customer-auth/request', 'POST', {}));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/customer-auth/verify', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('rejects an invalid code', async () => {
    const { POST } = await import('@/app/api/customer-auth/verify/route');
    const res = await POST(jsonReq('http://localhost/api/customer-auth/verify', 'POST', { email: 'x@example.test', code: '000000' }));
    expect(res.status).toBe(401);
  });

  it('rejects an EXPIRED code', async () => {
    const { POST } = await import('@/app/api/customer-auth/verify/route');
    const db = fakeDb.db as FakeDb;
    const customerId = new ObjectId();
    db.collection('customerClaims').seed([
      { codeHash: hash('123456'), customerId, email: 'x@example.test', expiresAt: new Date(Date.now() - 1000) },
    ]);
    const res = await POST(jsonReq('http://localhost/api/customer-auth/verify', 'POST', { email: 'x@example.test', code: '123456' }));
    expect(res.status).toBe(401);
  });

  it('a valid code sets the customerClaim cookie and the code is single-use', async () => {
    const { POST } = await import('@/app/api/customer-auth/verify/route');
    const db = fakeDb.db as FakeDb;
    const customerId = new ObjectId();
    db.collection('customerClaims').seed([
      { codeHash: hash('123456'), customerId, email: 'x@example.test', expiresAt: new Date(Date.now() + 60_000) },
    ]);

    const res = await POST(jsonReq('http://localhost/api/customer-auth/verify', 'POST', { email: 'x@example.test', code: '123456' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie') || '').toMatch(/customerClaim=/);
    expect(await db.collection('customerClaims').countDocuments({})).toBe(0); // single-use — deleted

    // Re-using the same code again must now fail.
    const second = await POST(jsonReq('http://localhost/api/customer-auth/verify', 'POST', { email: 'x@example.test', code: '123456' }));
    expect(second.status).toBe(401);
  });

  it('rejects a missing email or code', async () => {
    const { POST } = await import('@/app/api/customer-auth/verify/route');
    const res = await POST(jsonReq('http://localhost/api/customer-auth/verify', 'POST', { email: 'x@example.test' }));
    expect(res.status).toBe(400);
  });
});

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
