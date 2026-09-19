// src/lib/resolveTenantBySlug.ts
import { getDatabase } from './mongodb';
import { Tenant } from './types';

/**
 * Resolves an active tenant by its URL slug (e.g. from `/t/[tenantSlug]`).
 * Returns null if the tenant doesn't exist or is suspended — callers should
 * treat that as a 404, not a 500.
 *
 * This is the ONLY legitimate source of tenant identity for public,
 * unauthenticated requests. Never trust a tenantId supplied directly by the
 * client (header, query param, or body) for anything that reads or writes
 * tenant-scoped data.
 */
export async function resolveTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!slug) return null;
  const db = await getDatabase();
  const tenant = await db
    .collection<Tenant>('tenants')
    .findOne({ slug, status: 'active' });
  return tenant;
}
