// __tests__/helpers/nextRequest.ts
//
// Several routes read `req.cookies.get(...)` or `req.nextUrl.searchParams`
// (both `NextRequest`-only APIs — see next/server) instead of manually
// parsing the `cookie` header or `req.url`. A plain Fetch API `Request` has
// neither property, so passing one to those routes throws a TypeError
// rather than exercising the route's actual logic. `NextRequest` is a
// strict superset of `Request` (same constructor shape, plus `.cookies`
// and `.nextUrl`), so building one here is always safe — including for
// routes that only use plain `Request` features.
import { NextRequest } from 'next/server';

export function nextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init as any);
}
