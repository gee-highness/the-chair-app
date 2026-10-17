// __tests__/public-search.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function req(query: string) {
  return nextRequest(`http://localhost/api/public/search${query}`);
}

describe('GET /api/public/search', () => {
  let tenantA: ObjectId, tenantSuspended: ObjectId;

  beforeEach(() => {
    fakeDb.db = new FakeDb();
    tenantA = new ObjectId();
    tenantSuspended = new ObjectId();
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([
      { _id: tenantA, slug: 'fade-factory', name: 'Fade Factory', status: 'active', branding: { primaryColor: '#000' } },
      { _id: tenantSuspended, slug: 'closed-shop', name: 'Closed Shop', status: 'suspended', branding: {} },
    ]);
    db.collection('services').seed([
      { _id: new ObjectId(), tenantId: tenantA, name: 'Classic Fade', price: 30, duration: 30 },
      { _id: new ObjectId(), tenantId: tenantSuspended, name: 'Ghost Service', price: 10, duration: 10 },
    ]);
  });

  it('an empty query returns the full active-tenant listing (Priority 3 — default homepage listing)', async () => {
    const { GET } = await import('@/app/api/public/search/route');
    const res = await GET(req('?q='));
    const body = await res.json();
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0].name).toBe('Fade Factory');
  });

  it('never surfaces a suspended tenant, or its services, in either result list', async () => {
    const { GET } = await import('@/app/api/public/search/route');
    const res = await GET(req('?q='));
    const body = await res.json();
    expect(body.tenants.find((t: any) => t.name === 'Closed Shop')).toBeUndefined();
    expect(body.services.find((s: any) => s.name === 'Ghost Service')).toBeUndefined();
  });

  it('matches tenants and services by a case-insensitive substring', async () => {
    const { GET } = await import('@/app/api/public/search/route');
    const res = await GET(req('?q=fade'));
    const body = await res.json();
    expect(body.tenants).toHaveLength(1);
    expect(body.services).toHaveLength(1);
    expect(body.services[0].tenantName).toBe('Fade Factory'); // service result carries its tenant's name/slug
    expect(body.services[0].tenantSlug).toBe('fade-factory');
  });

  it('a query containing regex metacharacters does not throw or match everything (audit fix)', async () => {
    const { GET } = await import('@/app/api/public/search/route');
    // A pathological/invalid-as-regex query. If escapeRegex() weren't
    // applied, `new RegExp('(', 'i')` would throw a SyntaxError and this
    // request would 500.
    const res = await GET(req('?q=' + encodeURIComponent('(unclosed')));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants).toHaveLength(0); // no literal match, and nothing threw
  });

  it('with lat/lng, sorts tenants by distance and computes distanceKm from siteSettings.location', async () => {
    const { GET } = await import('@/app/api/public/search/route');
    const db = fakeDb.db as FakeDb;
    const tenantFar = new ObjectId();
    db.collection('tenants').seed([
      ...db.collection('tenants').docs,
      { _id: tenantFar, slug: 'far-salon', name: 'Far Salon', status: 'active', branding: {} },
    ]);
    db.collection('siteSettings').seed([
      { tenantId: tenantA, location: { lat: 40.7128, lng: -74.006 } }, // NYC
      { tenantId: tenantFar, location: { lat: 34.0522, lng: -118.2437 } }, // LA
    ]);

    // Querying from a point near NYC.
    const res = await GET(req('?q=&lat=40.7&lng=-74.0'));
    const body = await res.json();
    const names = body.tenants.map((t: any) => t.name);
    expect(names[0]).toBe('Fade Factory'); // closer tenant sorts first
    expect(body.tenants.find((t: any) => t.name === 'Fade Factory').distanceKm).toBeLessThan(50);
    expect(body.tenants.find((t: any) => t.name === 'Far Salon').distanceKm).toBeGreaterThan(1000);
  });

  it('maxDistanceKm filters out tenants beyond that radius', async () => {
    const { GET } = await import('@/app/api/public/search/route');
    const db = fakeDb.db as FakeDb;
    const tenantFar = new ObjectId();
    db.collection('tenants').seed([
      ...db.collection('tenants').docs,
      { _id: tenantFar, slug: 'far-salon', name: 'Far Salon', status: 'active', branding: {} },
    ]);
    db.collection('siteSettings').seed([
      { tenantId: tenantA, location: { lat: 40.7128, lng: -74.006 } },
      { tenantId: tenantFar, location: { lat: 34.0522, lng: -118.2437 } },
    ]);

    const res = await GET(req('?q=&lat=40.7&lng=-74.0&maxDistanceKm=100'));
    const body = await res.json();
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0].name).toBe('Fade Factory');
  });

  describe('card enrichment and barber results', () => {
    let barberTop: ObjectId, barberNew: ObjectId;
    beforeEach(() => {
      const db = fakeDb.db as FakeDb;
      barberTop = new ObjectId();
      barberNew = new ObjectId();
      db.collection('barbers').seed([
        { _id: barberTop, tenantId: tenantA, name: 'Marcus Cole', slug: 'marcus', tags: ['Fades', 'Beards'] },
        { _id: barberNew, tenantId: tenantA, name: 'Lee Park', slug: 'lee', tags: ['Braids'] },
        { _id: new ObjectId(), tenantId: tenantSuspended, name: 'Ghost Barber', slug: 'ghost', tags: [] },
      ]);
      db.collection('reviews').seed([
        { _id: new ObjectId(), tenantId: tenantA, barberId: barberTop, rating: 5, status: 'visible' },
        { _id: new ObjectId(), tenantId: tenantA, barberId: barberTop, rating: 4, status: 'visible' },
        { _id: new ObjectId(), tenantId: tenantA, barberId: barberNew, rating: 1, status: 'hidden' },
      ]);
    });

    it('adds rating, review count and price-from to each salon', async () => {
      const { GET } = await import('@/app/api/public/search/route');
      const body = await (await GET(req('?q='))).json();
      expect(body.tenants[0]).toMatchObject({ averageRating: 4.5, reviewCount: 2, minPrice: 30 });
    });

    it('lists barbers best-rated first, with their salon, and never from suspended salons', async () => {
      const { GET } = await import('@/app/api/public/search/route');
      const body = await (await GET(req('?q='))).json();
      expect(body.barbers.map((b: any) => b.slug)).toEqual(['marcus', 'lee']);
      expect(body.barbers[0]).toMatchObject({ tenantSlug: 'fade-factory', averageRating: 4.5, reviewCount: 2 });
    });

    it('matches barbers by name or tag', async () => {
      const { GET } = await import('@/app/api/public/search/route');
      const byTag = await (await GET(req('?q=braids'))).json();
      expect(byTag.barbers.map((b: any) => b.slug)).toEqual(['lee']);
      const byName = await (await GET(req('?q=marcus'))).json();
      expect(byName.barbers.map((b: any) => b.slug)).toEqual(['marcus']);
    });
  });
});
