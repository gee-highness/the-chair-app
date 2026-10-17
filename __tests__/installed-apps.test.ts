// @vitest-environment jsdom
// __tests__/installed-apps.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { appPath, forgetInstalledApp, installedKey, readInstalledApps, recordInstalledApp, INSTALLED_APPS_KEY } from '@/lib/installedApps';

describe('installed apps list', () => {
  beforeEach(() => localStorage.clear());

  it('records salons and barbers, newest first, one entry per app', () => {
    recordInstalledApp({ kind: 'salon', slug: 'quano', name: 'Quano Locs' });
    recordInstalledApp({ kind: 'barber', slug: 'quano', barberSlug: 'marcus', name: 'Marcus Cole' });
    recordInstalledApp({ kind: 'salon', slug: 'quano', name: 'Quano Locs (renamed)' }); // refreshed, not duplicated
    const list = readInstalledApps();
    expect(list.map((a) => a.name)).toEqual(['Quano Locs (renamed)', 'Marcus Cole']);
  });

  it('treats a salon and its barber as different apps', () => {
    expect(installedKey({ kind: 'salon', slug: 'quano' })).not.toBe(installedKey({ kind: 'barber', slug: 'quano', barberSlug: 'marcus' }));
    expect(appPath({ kind: 'salon', slug: 'quano' })).toBe('/t/quano');
    expect(appPath({ kind: 'barber', slug: 'quano', barberSlug: 'marcus' })).toBe('/t/quano/barbers/marcus');
  });

  it('forgets an app', () => {
    recordInstalledApp({ kind: 'salon', slug: 'a', name: 'A' });
    recordInstalledApp({ kind: 'salon', slug: 'b', name: 'B' });
    forgetInstalledApp({ kind: 'salon', slug: 'a' });
    expect(readInstalledApps().map((a) => a.slug)).toEqual(['b']);
  });

  it('ignores corrupt storage and malformed entries', () => {
    localStorage.setItem(INSTALLED_APPS_KEY, 'not json');
    expect(readInstalledApps()).toEqual([]);
    localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify([{ kind: 'salon' }, { kind: 'barber', slug: 'x', name: 'No barber slug' }, { kind: 'salon', slug: 'ok', name: 'OK', at: 1 }]));
    expect(readInstalledApps().map((a) => a.slug)).toEqual(['ok']);
  });
});
