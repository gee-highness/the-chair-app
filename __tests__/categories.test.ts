// __tests__/categories.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function hash(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function rawTokenFor(db: FakeDb, session: { subjectId: ObjectId; role: string; tenantId?: ObjectId }) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: session.subjectId, subjectType: 'user', role: session.role, tenantId: session.tenantId, expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function req(method: string, rawToken?: string, body?: any, url = 'http://localhost/api/categories') {
  return new Request(url, {
    method,
    headers: {
      ...(rawToken ? { cookie: `session=${rawToken}` } : {}),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as any;
}

describe('GET /api/categories', () => {
  let tenantA: ObjectId, tenantB: ObjectId;
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    tenantB = new ObjectId();
  });

  it('requires a staff session', async () => {
    const { GET } = await import('@/app/api/categories/route');
    const res = await GET(req('GET'));
    expect(res.status).toBe(401);
  });

  it('only returns categories for the caller\'s own tenant', async () => {
    const { GET } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    db.collection('categories').seed([
      { _id: new ObjectId(), tenantId: tenantA, name: 'Haircuts' },
      { _id: new ObjectId(), tenantId: tenantB, name: 'Coloring' },
    ]);
    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'barber', tenantId: tenantA });

    const res = await GET(req('GET', rawToken));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Haircuts');
  });
});

describe('POST /api/categories', () => {
  let tenantA: ObjectId;
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
  });

  it('receptionist cannot create a category (admin-only)', async () => {
    const { POST } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'receptionist', tenantId: tenantA });
    const res = await POST(req('POST', rawToken, { name: 'New Category' }));
    expect(res.status).toBe(401);
  });

  it('admin can create a category, scoped to their tenant', async () => {
    const { POST } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'admin', tenantId: tenantA });
    const res = await POST(req('POST', rawToken, { name: 'New Category' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tenantId.toString()).toBe(tenantA.toString());
  });

  it('rejects a missing name', async () => {
    const { POST } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'admin', tenantId: tenantA });
    const res = await POST(req('POST', rawToken, {}));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/categories', () => {
  let tenantA: ObjectId;
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
  });

  it('refuses to delete a category still referenced by a service (409)', async () => {
    const { DELETE } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    const categoryId = new ObjectId();
    db.collection('categories').seed([{ _id: categoryId, tenantId: tenantA, name: 'Haircuts' }]);
    db.collection('services').seed([{ _id: new ObjectId(), tenantId: tenantA, categoryId, name: 'Fade', duration: 30, price: 25 }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'admin', tenantId: tenantA });
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/categories?id=${categoryId}`));
    expect(res.status).toBe(409);
    expect(await db.collection('categories').countDocuments({})).toBe(1); // not deleted
  });

  it('deletes a category with no services attached', async () => {
    const { DELETE } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    const categoryId = new ObjectId();
    db.collection('categories').seed([{ _id: categoryId, tenantId: tenantA, name: 'Unused' }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'admin', tenantId: tenantA });
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/categories?id=${categoryId}`));
    expect(res.status).toBe(200);
    expect(await db.collection('categories').countDocuments({})).toBe(0);
  });

  it('cannot delete another tenant\'s category by id', async () => {
    const { DELETE } = await import('@/app/api/categories/route');
    const db = fakeDb.db as FakeDb;
    const tenantB = new ObjectId();
    const categoryId = new ObjectId();
    db.collection('categories').seed([{ _id: categoryId, tenantId: tenantB, name: 'Foreign' }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'admin', tenantId: tenantA });
    const res = await DELETE(req('DELETE', rawToken, undefined, `http://localhost/api/categories?id=${categoryId}`));
    expect(res.status).toBe(404);
    expect(await db.collection('categories').countDocuments({})).toBe(1); // untouched
  });
});

describe('PUT /api/categories', () => {
  it('ignores fields outside the allow-list (tenantId cannot be reassigned)', async () => {
    const { PUT } = await import('@/app/api/categories/route');
    const db = (fakeDb.db = new FakeDb());
    const tenantA = new ObjectId();
    const otherTenant = new ObjectId();
    const categoryId = new ObjectId();
    db.collection('categories').seed([{ _id: categoryId, tenantId: tenantA, name: 'Old Name' }]);

    const rawToken = rawTokenFor(db, { subjectId: new ObjectId(), role: 'admin', tenantId: tenantA });
    const res = await PUT(req('PUT', rawToken, { _id: categoryId.toString(), name: 'New Name', tenantId: otherTenant.toString() }));
    expect(res.status).toBe(200);
    const updated = await db.collection('categories').findOne({ _id: categoryId });
    expect(updated?.name).toBe('New Name');
    expect(updated?.tenantId.toString()).toBe(tenantA.toString());
  });
});
