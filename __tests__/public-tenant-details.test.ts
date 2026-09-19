// __tests__/public-tenant-details.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';

const fakeDb = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

function callGet(slug: string) {
  return import('@/app/api/public/tenants/[slug]/route').then(({ GET }) =>
    GET(nextRequest(`http://localhost/api/public/tenants/${slug}`), { params: Promise.resolve({ slug }) })
  );
}

describe('GET /api/public/tenants/[slug]', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
  });

  it('returns 404 for a slug that does not exist', async () => {
    const res = await callGet('nope');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a suspended tenant — must not leak that it exists with full details', async () => {
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: new ObjectId(), slug: 'closed', name: 'Closed Shop', status: 'suspended', branding: {} }]);
    const res = await callGet('closed');
    expect(res.status).toBe(404);
  });

  it('returns the tenant with settings, barbers, services, categories, and only VISIBLE reviews', async () => {
    const db = fakeDb.db as FakeDb;
    const tenantId = new ObjectId();
    db.collection('tenants').seed([{ _id: tenantId, slug: 'open-shop', name: 'Open Shop', status: 'active', branding: { primaryColor: '#000' } }]);
    db.collection('siteSettings').seed([{ tenantId, title: 'Open Shop', phone: '555-0100' }]);
    db.collection('barbers').seed([{ _id: new ObjectId(), tenantId, name: 'Alex', slug: 'alex', dailyAvailability: [] }]);
    db.collection('services').seed([{ _id: new ObjectId(), tenantId, name: 'Cut', price: 20, duration: 20 }]);
    db.collection('categories').seed([{ _id: new ObjectId(), tenantId, name: 'Haircuts' }]);
    db.collection('reviews').seed([
      { _id: new ObjectId(), tenantId, rating: 5, status: 'visible', createdAt: new Date('2026-01-01') },
      { _id: new ObjectId(), tenantId, rating: 1, status: 'flagged', createdAt: new Date('2026-01-02') }, // must be excluded
    ]);

    const res = await callGet('open-shop');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant.name).toBe('Open Shop');
    expect(body.barbers).toHaveLength(1);
    expect(body.services).toHaveLength(1);
    expect(body.categories).toHaveLength(1);
    expect(body.reviews).toHaveLength(1); // the flagged one is excluded
    expect(body.averageRating).toBe(5);
  });

  it('averageRating is null when there are no visible reviews yet', async () => {
    const db = fakeDb.db as FakeDb;
    const tenantId = new ObjectId();
    db.collection('tenants').seed([{ _id: tenantId, slug: 'new-shop', name: 'New Shop', status: 'active', branding: {} }]);

    const res = await callGet('new-shop');
    const body = await res.json();
    expect(body.averageRating).toBeNull();
    expect(body.reviews).toEqual([]);
  });
});
