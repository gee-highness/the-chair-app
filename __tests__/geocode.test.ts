// __tests__/geocode.test.ts
//
// GET /api/geocode proxies to Nominatim via the real global fetch — every
// test here mocks global.fetch, so nothing in this file makes a real
// network call.
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

function adminToken(db: FakeDb) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: new ObjectId(), expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function req(query: string, rawToken?: string) {
  return nextRequest(`http://localhost/api/geocode${query}`, {
    headers: rawToken ? { cookie: `session=${rawToken}` } : {},
  });
}

const originalFetch = global.fetch;

describe('GET /api/geocode', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requires an admin session', async () => {
    const { GET } = await import('@/app/api/geocode/route');
    const res = await GET(req('?q=Main Street'));
    expect(res.status).toBe(401);
  });

  it('rejects a query under 3 characters', async () => {
    const { GET } = await import('@/app/api/geocode/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await GET(req('?q=NY', rawToken));
    expect(res.status).toBe(400);
  });

  it('maps Nominatim results to {label, lat, lng}', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { display_name: '1 Main St, Testville', lat: '40.7128', lon: '-74.0060' },
      ],
    })) as any;

    const { GET } = await import('@/app/api/geocode/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await GET(req('?q=Main Street', rawToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ label: '1 Main St, Testville', lat: 40.7128, lng: -74.006 }]);
  });

  it('returns 502 (not a 500 crash) when Nominatim itself errors', async () => {
    global.fetch = vi.fn(async () => ({ ok: false })) as any;

    const { GET } = await import('@/app/api/geocode/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await GET(req('?q=Main Street', rawToken));
    expect(res.status).toBe(502);
  });

  it('returns 502 (degrades gracefully) when fetch itself throws (network unreachable)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network unreachable');
    }) as any;

    const { GET } = await import('@/app/api/geocode/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await GET(req('?q=Main Street', rawToken));
    expect(res.status).toBe(502);
  });
});
