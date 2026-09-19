// __tests__/customers.test.ts
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

function req(method: string, rawToken?: string, body?: any) {
  return nextRequest('http://localhost/api/customers', {
    method,
    headers: { ...(rawToken ? { cookie: `session=${rawToken}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/customers', () => {
  it('only returns customers with a loyalty relationship to the caller\'s tenant, and never passwordHash', async () => {
    const { GET } = await import('@/app/api/customers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    db.collection('customers').seed([
      { _id: new ObjectId(), name: 'Mine', email: 'mine@example.test', passwordHash: 'secret', loyaltyPoints: { [tenantA.toString()]: 5 } },
      { _id: new ObjectId(), name: 'Not Mine', email: 'notmine@example.test', loyaltyPoints: { [tenantB.toString()]: 5 } },
    ]);
    const rawToken = staffToken(db, 'receptionist', tenantA);
    const res = await GET(req('GET', rawToken));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Mine');
    expect(body[0].passwordHash).toBeUndefined();
  });

  it('barber role cannot list customers (admin/receptionist only)', async () => {
    const { GET } = await import('@/app/api/customers/route');
    const db = (fakeDb.db = new FakeDb());
    const rawToken = staffToken(db, 'barber', new ObjectId());
    const res = await GET(req('GET', rawToken));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/customers', () => {
  it('creates a brand-new customer with a loyalty entry for the caller\'s tenant', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'New Customer', email: 'new@example.test', phone: '555-0100' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.loyaltyPoints[tenantA.toString()]).toBe(0);
  });

  it('attaches an EXISTING customer (by email) to a new tenant, preserving their loyalty points at other tenants', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    const existingId = new ObjectId();
    db.collection('customers').seed([
      { _id: existingId, name: 'Returning', email: 'returning@example.test', phone: '555-0199', loyaltyPoints: { [tenantB.toString()]: 42 } },
    ]);
    const rawToken = staffToken(db, 'admin', tenantA);
    const res = await POST(req('POST', rawToken, { name: 'Returning', email: 'returning@example.test', phone: '555-0199' }));
    expect(res.status).toBe(200); // find-or-attach, not a new document
    const body = await res.json();
    expect(body._id.toString()).toBe(existingId.toString());
    expect(body.loyaltyPoints[tenantA.toString()]).toBe(0);
    expect(body.loyaltyPoints[tenantB.toString()]).toBe(42); // untouched
    expect(await db.collection('customers').countDocuments({})).toBe(1); // no duplicate created
  });

  it('rejects missing required fields', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const db = (fakeDb.db = new FakeDb());
    const rawToken = staffToken(db, 'admin', new ObjectId());
    const res = await POST(req('POST', rawToken, { name: 'Incomplete' }));
    expect(res.status).toBe(400);
  });
});
