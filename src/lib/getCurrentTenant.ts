// src/lib/getCurrentTenant.ts
//
// Repurposed for path-based tenant routing: tenant identity now comes from
// the `tenantSlug` route param (see src/app/t/[tenantSlug]/**), resolved
// server-side against the database — never from a request header, since
// there is no middleware rewriting requests to inject one.
import { resolveTenantBySlug } from './resolveTenantBySlug';

export async function getCurrentTenant(tenantSlug: string) {
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  return tenant;
}
