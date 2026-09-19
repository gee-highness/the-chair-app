// __tests__/platform-tenants.test.ts
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

function superAdminToken(db: FakeDb) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: new ObjectId(), subjectType: 'user', role: 'super_admin', expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function tenantStaffToken(db: FakeDb, tenantId: ObjectId) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId, expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function req(method: string, rawToken?: string, body?: any) {
  return new Request('http://localhost/api/platform/tenants', {
    method,
    headers: { ...(rawToken ? { cookie: `session=${rawToken}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as any;
}

describe('GET /api/platform/tenants', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('rejects a tenant-scoped admin — this is super_admin only', async () => {
    const { GET } = await import('@/app/api/platform/tenants/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = tenantStaffToken(db, new ObjectId());
    const res = await GET(req('GET', rawToken));
    expect(res.status).toBe(401);
  });

  it('super_admin sees every tenant across the platform', async () => {
    const { GET } = await import('@/app/api/platform/tenants/route');
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([
      { _id: new ObjectId(), slug: 'salon-a', name: 'Salon A', status: 'active' },
      { _id: new ObjectId(), slug: 'salon-b', name: 'Salon B', status: 'suspended' },
    ]);
    const rawToken = superAdminToken(db);
    const res = await GET(req('GET', rawToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe('POST /api/platform/tenants', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('creates a tenant, its first admin user, and default siteSettings in one call', async () => {
    const { POST } = await import('@/app/api/platform/tenants/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = superAdminToken(db);

    const res = await POST(
      req('POST', rawToken, {
        slug: 'new-salon',
        name: 'New Salon',
        contactEmail: 'contact@new-salon.test',
        adminEmail: 'admin@new-salon.test',
        adminPassword: 'StrongPass123!',
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const tenantId = body._id;

    const adminUser = await db.collection('users').findOne({ email: 'admin@new-salon.test' });
    expect(adminUser?.role).toBe('admin');
    expect(adminUser?.tenantId.toString()).toBe(tenantId.toString());
    // Password must be hashed, never stored in plaintext.
    expect(adminUser?.passwordHash).not.toBe('StrongPass123!');

    const settings = await db.collection('siteSettings').findOne({ tenantId });
    expect(settings?.title).toBe('New Salon');
  });

  it('rejects a duplicate slug with 409 and creates nothing', async () => {
    const { POST } = await import('@/app/api/platform/tenants/route');
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: new ObjectId(), slug: 'taken-slug', name: 'Existing', status: 'active' }]);
    const rawToken = superAdminToken(db);

    const res = await POST(
      req('POST', rawToken, {
        slug: 'taken-slug',
        name: 'Second Salon',
        contactEmail: 'x@example.test',
        adminEmail: 'admin2@example.test',
        adminPassword: 'StrongPass123!',
      })
    );
    expect(res.status).toBe(409);
    expect(await db.collection('users').countDocuments({ email: 'admin2@example.test' })).toBe(0);
  });

  it('rejects missing required fields', async () => {
    const { POST } = await import('@/app/api/platform/tenants/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = superAdminToken(db);
    const res = await POST(req('POST', rawToken, { slug: 'incomplete' }));
    expect(res.status).toBe(400);
  });

  it('a tenant-scoped admin cannot create a new tenant', async () => {
    const { POST } = await import('@/app/api/platform/tenants/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = tenantStaffToken(db, new ObjectId());
    const res = await POST(req('POST', rawToken, { slug: 'x', name: 'X', contactEmail: 'x@x.test', adminEmail: 'a@x.test', adminPassword: 'pw' }));
    expect(res.status).toBe(401);
  });
});
