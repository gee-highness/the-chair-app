// __tests__/barber-manifest.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { FakeDb } from './helpers/fakeMongo';

const fakeDb = vi.hoisted(() => ({ db: null as any }));
vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

describe('barber app manifest', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    const tenantId = new ObjectId();
    const db = fakeDb.db as FakeDb;
    db.collection('tenants').seed([{ _id: tenantId, slug: 'acme', name: 'Acme Cuts', status: 'active', branding: { primaryColor: '#123456' } }]);
    db.collection('barbers').seed([{ _id: new ObjectId(), tenantId, name: 'Marcus Cole', slug: 'marcus', imageUrl: 'https://img.test/m.png', bio: 'Fades.' }]);
  });

  it('is a separate installable app for the barber, scoped to their path', async () => {
    const manifest = (await import('@/app/t/[tenantSlug]/barbers/[barberSlug]/manifest')).default;
    const m = await manifest({ params: Promise.resolve({ tenantSlug: 'acme', barberSlug: 'marcus' }) });
    expect(m.id).toBe('/t/acme/barbers/marcus');
    expect(m.scope).toBe('/t/acme/barbers/marcus/');
    expect(m.start_url).toBe('/t/acme/barbers/marcus');
    expect(m.name).toBe('Marcus Cole · Acme Cuts');
    expect(m.short_name).toBe('Marcus');
    expect(m.theme_color).toBe('#123456');
    expect(m.icons?.[0].src).toBe('https://img.test/m.png');
  });

  it('falls back to the platform app for an unknown barber', async () => {
    const manifest = (await import('@/app/t/[tenantSlug]/barbers/[barberSlug]/manifest')).default;
    const m = await manifest({ params: Promise.resolve({ tenantSlug: 'acme', barberSlug: 'nobody' }) });
    expect(m.start_url).toBe('/');
  });
});
