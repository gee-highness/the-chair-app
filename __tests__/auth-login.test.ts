// __tests__/auth-login.test.ts
//
// Login flow regression tests for both branches added in Phase 3:
// tenant-scoped staff login (tenantSlug required) and super_admin login
// (tenantSlug absent, looked up by { email, role: 'super_admin' } only).
//
// Run with: npx vitest run __tests__/auth-login.test.ts (not executed here — see note in tenant-scoping.test.ts)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { FakeDb } from './helpers/fakeMongo';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function loginRequest(body: any) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('logs in tenant-scoped staff with a valid tenantSlug + password, sets a session cookie', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const db = fakeDb.db as FakeDb;

    const tenantId = new ObjectId();
    db.collection('tenants').seed([{ _id: tenantId, slug: 'acme-salon', status: 'active' }]);
    db.collection('users').seed([
      {
        _id: new ObjectId(),
        tenantId,
        email: 'admin@acme.com',
        username: 'Admin',
        role: 'admin',
        passwordHash: await bcrypt.hash('correct-password', 4),
      },
    ]);

    const res = await POST(loginRequest({ email: 'admin@acme.com', password: 'correct-password', tenantSlug: 'acme-salon' }));
    expect(res.status).toBe(200);
    expect(res.cookies.get('session')?.value).toBeTruthy();

    const body = await res.json();
    expect(body.user.role).toBe('admin');
  });

  it('rejects tenant-scoped login against a suspended tenant', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const db = fakeDb.db as FakeDb;

    db.collection('tenants').seed([{ _id: new ObjectId(), slug: 'closed-salon', status: 'suspended' }]);

    const res = await POST(loginRequest({ email: 'x@x.com', password: 'whatever', tenantSlug: 'closed-salon' }));
    expect(res.status).toBe(401);
  });

  it('logs in super_admin with no tenantSlug, looked up by role alone', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const db = fakeDb.db as FakeDb;

    db.collection('users').seed([
      {
        _id: new ObjectId(),
        // no tenantId — super_admin
        email: 'root@platform.com',
        username: 'Super Admin',
        role: 'super_admin',
        passwordHash: await bcrypt.hash('root-password', 4),
      },
    ]);

    const res = await POST(loginRequest({ email: 'root@platform.com', password: 'root-password' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('super_admin');
  });

  it('a tenant-scoped user cannot log in through the super_admin (no-tenantSlug) branch', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const db = fakeDb.db as FakeDb;

    db.collection('users').seed([
      { _id: new ObjectId(), tenantId: new ObjectId(), email: 'admin@acme.com', role: 'admin', passwordHash: await bcrypt.hash('pw', 4) },
    ]);

    // Omitting tenantSlug makes login.ts query { email, role: 'super_admin' } —
    // an 'admin' role user must not match.
    const res = await POST(loginRequest({ email: 'admin@acme.com', password: 'pw' }));
    expect(res.status).toBe(401);
  });

  it('rate-limits after 5 attempts for the same email within 15 minutes', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: new ObjectId(), slug: 'acme-salon', status: 'active' }]);

    let last;
    for (let i = 0; i < 6; i++) {
      last = await POST(loginRequest({ email: 'attacker@x.com', password: 'guess', tenantSlug: 'acme-salon' }));
    }
    expect(last!.status).toBe(429);
  });
});
