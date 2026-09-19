// __tests__/helpers/fetchMock.ts
//
// A small helper for component/page tests that call fetch(). Not a
// vi.mock() module — just a factory for a vi.fn() stub — so it can be
// imported and called directly inside a test body with no hoisting
// concerns (unlike vi.mock, which must be a static top-level call).
import { vi } from 'vitest';

type RouteHandler = (url: string, init?: RequestInit) => { status?: number; json?: any } | Promise<{ status?: number; json?: any }>;

/**
 * Installs `global.fetch` as a vi.fn() that dispatches to `routes` by
 * matching the request URL against each key (substring match, checked in
 * declaration order — put more specific routes first). Returns the mock so
 * a test can also assert on call args (`fetchMock.mock.calls`).
 *
 * Example:
 *   mockFetch({
 *     '/api/barbers': () => ({ json: [{ _id: '1', name: 'Alex' }] }),
 *     '/api/services': () => ({ status: 401, json: { message: 'Unauthorized' } }),
 *   });
 */
export function mockFetch(routes: Record<string, RouteHandler>) {
  const fn = vi.fn(async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) {
      throw new Error(`fetchMock: no route registered for "${url}". Registered: ${Object.keys(routes).join(', ')}`);
    }
    const result = await routes[key](url, init);
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result.json,
    } as Response;
  });
  global.fetch = fn as any;
  return fn;
}

/** A fetch mock that always resolves ok with the same JSON body — for tests that only need one endpoint. */
export function mockFetchOnce(json: any, status = 200) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  }));
  global.fetch = fn as any;
  return fn;
}
