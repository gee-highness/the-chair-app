// src/app/api/geocode/route.ts
//
// Proxies free-text address search to OpenStreetMap's Nominatim, so the
// admin's "search for a starting point" box in the location picker doesn't
// need a paid geocoding API key. Nominatim's usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) requires:
//   - a descriptive User-Agent identifying the application (set below)
//   - no more than ~1 request/second, and no autocomplete-on-keystroke —
//     enforced here by only calling this route on an explicit "Search"
//     button press client-side (never on every keystroke), plus a light
//     in-memory per-process throttle as a second line of defense.
// This proxy also means the client never talks to nominatim.org directly,
// so no CORS configuration is needed on their end.
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

const USER_AGENT = 'TheChairApp/1.0 (booking-platform; contact via tenant admin)';

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1000;

export async function GET(req: NextRequest) {
  // Only staff configuring their own tenant's location may geocode —
  // this isn't a public endpoint.
  const session = await requireRole(req, ['admin']);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q');
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ message: 'Query too short' }, { status: 400 });
  }

  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return NextResponse.json({ message: 'Geocoding failed' }, { status: 502 });

    const results = await res.json();
    return NextResponse.json(
      results.map((r: any) => ({
        label: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      }))
    );
  } catch (error: any) {
    // Degrade gracefully — the map picker still works via drag-a-pin even
    // if the geocode search is unreachable.
    return NextResponse.json({ message: 'Geocoding unavailable', error: error.message }, { status: 502 });
  }
}
