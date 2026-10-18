// __tests__/manifests.test.ts
//
// Each installable app must link ITS OWN manifest. Next.js only honours the
// `manifest.ts` convention at the app root, so nested ones were never linked
// and every salon/barber install silently became the Discovery app.
import { describe, it, expect } from 'vitest';
import { adminManifest, rootManifest, manifestResponse } from '@/lib/manifests';

describe('manifests', () => {
  it('gives the root, admin, salon and barber apps distinct ids', () => {
    expect(rootManifest().id).toBe('/');
    expect(adminManifest().id).toBe('/admin');
    expect(rootManifest().id).not.toBe(adminManifest().id);
  });

  it('serves manifests as application/manifest+json', async () => {
    const res = manifestResponse(rootManifest());
    expect(res.headers.get('content-type')).toContain('application/manifest+json');
    expect((await res.json()).start_url).toBe('/');
  });
});
