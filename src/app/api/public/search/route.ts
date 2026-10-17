// src/app/api/public/search/route.ts
//
// Discovery search. Two fixes/extensions bundled in one pass (see
// AUDIT_REPORT.md and PROGRESS2.md Phase F — this route was going to be
// touched twice otherwise):
//   1. Audit fix: `q` is regex-escaped before hitting $regex — previously
//      raw user input reached the regex engine (ReDoS / malformed-pattern
//      500 risk).
//   2. Phase F: service results now carry their tenant's name/slug (so a
//      result is actually clickable — previously a service card had no
//      link to the salon it belonged to, and could show for a since-
//      suspended tenant since services were never filtered against
//      tenant.status). Optional lat/lng adds a distance-from-me sort and
//      maxDistanceKm filter for "near me" browsing, using the geolocation
//      the client already asked permission for.
//   3. Nav-audit follow-up: location/barbers used to be attached to a
//      tenant result ONLY when the caller supplied lat/lng, because that
//      was the sole consumer (the "near me" map). The discovery page now
//      has an explicit map view that doesn't require geolocation — every
//      request needs pins to hand it — so this always joins location and
//      barbers; only the distance sort/filter stays gated on hasGeo.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { escapeRegex } from '@/lib/text';
import { haversineKm } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawQuery = req.nextUrl.searchParams.get('q') || '';
    const query = escapeRegex(rawQuery);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20') || 20, 100);
    const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '');
    const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '');
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const maxDistanceKmParam = req.nextUrl.searchParams.get('maxDistanceKm');
    const maxDistanceKm = maxDistanceKmParam ? parseFloat(maxDistanceKmParam) : undefined;

    const db = await getDatabase();

    // All active tenants — used both to render "Salons" results and as the
    // join/allowlist for "Services" results (a suspended tenant's services
    // must never surface here).
    const activeTenants = await db
      .collection('tenants')
      .find({ status: 'active' }, { projection: { name: 1, slug: 1, branding: 1, currency: 1 } })
      .toArray();
    const tenantById = new Map(activeTenants.map((t) => [t._id.toString(), t]));

    let matchedTenants = query
      ? activeTenants.filter((t) => new RegExp(query, 'i').test(t.name) || new RegExp(query, 'i').test(t.slug))
      : activeTenants;

    // Services matched by name/description, restricted to active tenants.
    const activeTenantIds = activeTenants.map((t) => t._id);
    const serviceFilter: Record<string, any> = { tenantId: { $in: activeTenantIds } };
    if (query) {
      serviceFilter.$or = [{ name: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } }];
    }
    const rawServices = await db
      .collection('services')
      .find(serviceFilter, { projection: { tenantId: 1, name: 1, price: 1, duration: 1, imageUrl: 1 } })
      .limit(limit)
      .toArray();

    const services = rawServices
      .map((s) => {
        const tenant = tenantById.get(s.tenantId.toString());
        if (!tenant) return null;
        return { ...s, tenantName: tenant.name, tenantSlug: tenant.slug, tenantCurrency: tenant.currency };
      })
      .filter(Boolean);

    // Location: always joined now (the map view needs pins whether or not
    // the visitor granted geolocation). A tenant's location lives on
    // siteSettings, not the tenant document.
    const tenantIds = matchedTenants.map((t) => t._id);
    const settingsList = await db
      .collection('siteSettings')
      .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, location: 1, title: 1, logoUrl: 1, description: 1 } })
      .toArray();
    const settingsByTenant = new Map(settingsList.map((s) => [s.tenantId.toString(), s]));
    const locationByTenant = new Map(
      settingsList.filter((s) => s.location?.lat != null && s.location?.lng != null).map((s) => [s.tenantId.toString(), s.location])
    );

    let tenantsWithDistance: any[] = matchedTenants.map((t) => {
      const loc = locationByTenant.get(t._id.toString());
      const distanceKm = hasGeo && loc ? haversineKm({ lat, lng }, loc) : null;
      return { ...t, distanceKm, lat: loc?.lat ?? null, lng: loc?.lng ?? null };
    });

    if (hasGeo) {
      tenantsWithDistance = tenantsWithDistance
        .filter((t) => (maxDistanceKm != null ? t.distanceKm != null && t.distanceKm <= maxDistanceKm : true))
        .sort((a, b) => {
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
    }

    // Barber discovery (Part 3): attach each returned salon's barbers so a
    // map pin's popup can list/link to them, not just the salon. Only
    // fetched for the tenants actually being returned (post-slice).
    const pinnedTenants = tenantsWithDistance.slice(0, limit);
    const pinnedTenantIds = pinnedTenants.map((t) => t._id);
    const barbersRaw = await db
      .collection('barbers')
      .find({ tenantId: { $in: pinnedTenantIds } }, { projection: { tenantId: 1, name: 1, slug: 1, imageUrl: 1, tags: 1, bio: 1 } })
      .toArray();
    const barbersByTenant = new Map<string, { _id: string; name: string; slug: string; imageUrl?: string }[]>();
    for (const b of barbersRaw) {
      const key = b.tenantId.toString();
      const list = barbersByTenant.get(key) || [];
      list.push({ _id: b._id.toString(), name: b.name, slug: b.slug, imageUrl: b.imageUrl });
      barbersByTenant.set(key, list);
    }
    // Card enrichment (discovery overhaul): rating, price-from, logo and
    // tagline per salon, rating per barber. Computed in JS from two small
    // reads so it works the same on every Mongo deployment.
    // A text query also finds barbers whose SALON doesn't match it ("braids"
    // names no salon but should still surface the barbers who do braids), so
    // barber candidates come from every active salon in that case.
    const needle = rawQuery.trim().toLowerCase();
    const candidateBarbers = needle
      ? await db
          .collection('barbers')
          .find({ tenantId: { $in: activeTenantIds } }, { projection: { tenantId: 1, name: 1, slug: 1, imageUrl: 1, tags: 1, bio: 1 } })
          .toArray()
      : barbersRaw;
    const candidateTenantIds = needle ? activeTenantIds : pinnedTenantIds;
    const [reviewRows, priceRows, followRows] = await Promise.all([
      db
        .collection('reviews')
        .find({ tenantId: { $in: candidateTenantIds }, status: 'visible' }, { projection: { tenantId: 1, barberId: 1, rating: 1 } })
        .toArray(),
      db.collection('services').find({ tenantId: { $in: pinnedTenantIds } }, { projection: { tenantId: 1, price: 1 } }).toArray(),
      db.collection('follows').find({ barberId: { $in: candidateBarbers.map((b) => b._id) } }, { projection: { barberId: 1 } }).toArray(),
    ]);
    const tally = (rows: any[], key: string) => {
      const m = new Map<string, { sum: number; n: number }>();
      for (const r of rows) {
        if (r[key] == null || typeof r.rating !== 'number') continue;
        const k = r[key].toString();
        const cur = m.get(k) || { sum: 0, n: 0 };
        cur.sum += r.rating;
        cur.n += 1;
        m.set(k, cur);
      }
      return m;
    };
    const tenantRatings = tally(reviewRows, 'tenantId');
    const barberRatings = tally(reviewRows, 'barberId');
    const minPriceByTenant = new Map<string, number>();
    for (const p of priceRows) {
      if (typeof p.price !== 'number') continue;
      const k = p.tenantId.toString();
      minPriceByTenant.set(k, Math.min(minPriceByTenant.get(k) ?? Infinity, p.price));
    }
    const followersByBarber = new Map<string, number>();
    for (const f of followRows) {
      const k = f.barberId.toString();
      followersByBarber.set(k, (followersByBarber.get(k) || 0) + 1);
    }

    tenantsWithDistance = tenantsWithDistance.map((t) => {
      const key = t._id.toString();
      const st = settingsByTenant.get(key);
      const rating = tenantRatings.get(key);
      return {
        ...t,
        barbers: barbersByTenant.get(key) || [],
        logoUrl: st?.logoUrl ?? null,
        tagline: st?.description ?? null,
        averageRating: rating ? rating.sum / rating.n : null,
        reviewCount: rating?.n ?? 0,
        minPrice: minPriceByTenant.get(key) ?? null,
      };
    });

    // Barber results: matches by name/tag/bio for a query, otherwise the
    // best-rated and most-followed barbers among the salons returned.
    const salonByTenantId = new Map(tenantsWithDistance.map((t) => [t._id.toString(), t]));
    const barberResults = candidateBarbers
      .map((b) => {
        const salon: any = salonByTenantId.get(b.tenantId.toString()) || tenantById.get(b.tenantId.toString());
        if (!salon) return null;
        const r = barberRatings.get(b._id.toString());
        return {
          _id: b._id.toString(),
          name: b.name,
          slug: b.slug,
          imageUrl: b.imageUrl ?? null,
          tags: b.tags || [],
          tenantName: salon.name,
          tenantSlug: salon.slug,
          distanceKm: salon.distanceKm ?? null,
          averageRating: r ? r.sum / r.n : null,
          reviewCount: r?.n ?? 0,
          followerCount: followersByBarber.get(b._id.toString()) || 0,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .filter(
        (b) =>
          !needle ||
          b.name.toLowerCase().includes(needle) ||
          b.tags.some((t: string) => t.toLowerCase().includes(needle)) ||
          String(candidateBarbers.find((x) => x._id.toString() === b._id)?.bio || '').toLowerCase().includes(needle)
      )
      .sort(
        (a, b) =>
          (b.averageRating ?? 0) - (a.averageRating ?? 0) ||
          b.followerCount - a.followerCount ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 12);

    return NextResponse.json({
      tenants: tenantsWithDistance.slice(0, limit),
      services,
      barbers: barberResults,
      query: rawQuery,
    });
  } catch (error: any) {
    return NextResponse.json({ message: 'Search failed', error: error.message }, { status: 500 });
  }
}
