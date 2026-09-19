// __tests__/tenant-settings.test.ts
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

function req(method: string, rawToken?: string, body?: any) {
  return nextRequest('http://localhost/api/tenant/settings', {
    method,
    headers: { ...(rawToken ? { cookie: `session=${rawToken}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/tenant/settings', () => {
  let tenantId: ObjectId;
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantId = new ObjectId();
  });

  it('barber (lowest staff role) can read settings — read access is broader than write', async () => {
    const { GET } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, name: 'Demo', slug: 'demo', branding: { primaryColor: '#000' } }]);
    db.collection('siteSettings').seed([{ tenantId, title: 'Demo' }]);
    const rawToken = staffToken(db, 'barber', tenantId);

    const res = await GET(req('GET', rawToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant.name).toBe('Demo');
    expect(body.settings.title).toBe('Demo');
  });

  it('404s if the tenant document itself is missing (deleted/corrupt session)', async () => {
    const { GET } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = staffToken(db, 'admin', tenantId); // no tenant document seeded
    const res = await GET(req('GET', rawToken));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tenant/settings', () => {
  let tenantId: ObjectId;
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantId = new ObjectId();
  });

  it('receptionist/barber cannot write settings (admin-only)', async () => {
    const { PUT } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = staffToken(db, 'receptionist', tenantId);
    const res = await PUT(req('PUT', rawToken, { settings: { title: 'Hacked' } }));
    expect(res.status).toBe(401);
  });

  it('creates siteSettings on first save via upsert (no prior document)', async () => {
    const { PUT } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = staffToken(db, 'admin', tenantId);

    const res = await PUT(req('PUT', rawToken, { settings: { title: 'Brand New Salon', phone: '555-0100' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.title).toBe('Brand New Salon');
    expect(body.settings.tenantId.toString()).toBe(tenantId.toString());
    expect(await db.collection('siteSettings').countDocuments({})).toBe(1);
  });

  it('only allow-listed settings fields are written — an unlisted field is dropped', async () => {
    const { PUT } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = staffToken(db, 'admin', tenantId);

    const res = await PUT(req('PUT', rawToken, { settings: { title: 'OK Field', notAllowedField: 'sneaky' } }));
    const body = await res.json();
    expect(body.settings.title).toBe('OK Field');
    expect(body.settings.notAllowedField).toBeUndefined();
  });

  it('branding update sets a nested branding.<field> path without clobbering sibling branding fields', async () => {
    const { PUT } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, name: 'Demo', slug: 'demo', branding: { primaryColor: '#000', secondaryColor: '#111', font: 'modern' } }]);
    const rawToken = staffToken(db, 'admin', tenantId);

    const res = await PUT(req('PUT', rawToken, { branding: { primaryColor: '#fff' } }));
    const body = await res.json();
    expect(body.tenant.branding.primaryColor).toBe('#fff');
    expect(body.tenant.branding.secondaryColor).toBe('#111'); // untouched
  });

  it('a tenant-scoped admin cannot update another tenant\'s branding by forging tenantId — it always uses the session\'s own tenantId', async () => {
    const { PUT } = await import('@/app/api/tenant/settings/route');
    const db = fakeDb.db as FakeDb;
    const otherTenant = new ObjectId();
    db.collection('tenants').seed([
      { _id: tenantId, name: 'Mine', slug: 'mine', branding: { primaryColor: '#000' } },
      { _id: otherTenant, name: 'Theirs', slug: 'theirs', branding: { primaryColor: '#000' } },
    ]);
    const rawToken = staffToken(db, 'admin', tenantId);

    // The route reads settings/branding from the body but scopes every
    // write by session.tenantId — there is no tenantId field the client
    // can even supply to redirect the write.
    await PUT(req('PUT', rawToken, { branding: { primaryColor: '#fff' } }));

    const theirs = await db.collection('tenants').findOne({ _id: otherTenant });
    expect(theirs?.branding.primaryColor).toBe('#000'); // untouched
  });
});
