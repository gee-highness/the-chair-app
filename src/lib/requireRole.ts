// src/lib/requireRole.ts
import { verifySessionToken } from './auth';
import { Session } from './types';

/**
 * Verifies the session cookie and checks the caller's role.
 *
 * Tenant scoping is NOT done here and is NOT based on any client-supplied
 * header — callers must use `session.tenantId` (set at login, verified
 * server-side via the session token) as the only source of truth for which
 * tenant's data a request is allowed to touch. `super_admin` sessions have
 * no `tenantId` at all, which is expected — platform-admin routes should not
 * require one.
 */
export async function requireRole(
  request: Request,
  allowedRoles: string[]
): Promise<Session | null> {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  const token = match?.[1];

  const session = await verifySessionToken(token);
  if (!session) return null;

  if (!allowedRoles.includes(session.role)) return null;

  return session;
}
