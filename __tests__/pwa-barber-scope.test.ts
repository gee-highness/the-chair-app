// __tests__/pwa-barber-scope.test.ts
import { describe, it, expect } from 'vitest';
import { scopeForPathname, dynamicCacheNameForPathname } from '@/lib/pwaScope';

describe('barber app scope', () => {
  it('gives each barber their own scope, nested inside the salon', () => {
    expect(scopeForPathname('/t/acme/barbers/marcus')).toBe('/t/acme/barbers/marcus/');
    expect(scopeForPathname('/t/acme/barbers/marcus/book')).toBe('/t/acme/barbers/marcus/');
  });

  it('keeps salon, admin and root scopes unchanged', () => {
    expect(scopeForPathname('/t/acme/book')).toBe('/t/acme/');
    expect(scopeForPathname('/admin/tenants')).toBe('/admin/');
    expect(scopeForPathname('/')).toBe('/');
  });

  it('namespaces the cache per barber so one install never clears another', () => {
    expect(dynamicCacheNameForPathname('/t/acme/barbers/marcus')).toBe('chair-app-v1-b-acme-marcus-dynamic');
    expect(dynamicCacheNameForPathname('/t/acme/barbers/lee')).not.toBe(dynamicCacheNameForPathname('/t/acme/barbers/marcus'));
    expect(dynamicCacheNameForPathname('/t/acme')).toBe('chair-app-v1-t-acme-dynamic');
  });
});
